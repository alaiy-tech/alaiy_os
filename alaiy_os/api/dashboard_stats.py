"""Stats behind the OS home dashboard (the KPI strip + Sales Overview chart).

Kept separate from sales_order_stats/item_stats because the dashboard mixes
doctypes - Sales Order, Customer, Sales Invoice and Stock Reconciliation all
feed one strip, and it wants them in a single round-trip.

Everything money-shaped is read from Sales Order (booked/committed), the same
basis the rest of the OS uses, so the dashboard never disagrees with the Sales
Orders page.
"""

import calendar

import frappe
from frappe.utils import add_days, cint, getdate, nowdate

PERIOD_DAYS = {"1D": 1, "1W": 7, "1M": 30, "1Y": 365}

# The Sales Overview chart is a fixed rolling 12-month view - it is deliberately
# NOT scoped by the period toggle (that scopes the KPI cards), since a 1D window
# has nothing to draw. Each month is split into the six day-ranges the chart's
# x-axis labels are built around.
TREND_MONTHS = 12
TREND_DAY_BUCKETS = ((1, 5), (6, 10), (11, 15), (16, 20), (21, 25), (26, 31))

# The channel filter reads Sales Order's `sales_channel` custom field, which the
# marketplace connectors (Shopify/Amazon/...) stamp with the order's origin. A
# site without those connectors has no such column, so every channel helper
# degrades to "no filtering" rather than throwing.
CHANNEL_FIELD = "sales_channel"

# Stock Reconciliation stores counted vs system qty as Floats, so "matched"
# means "within a rounding error of each other", not "=".
QTY_TOLERANCE = 0.001

# The Top Products card lists three products and segments its bar into three
# categories plus an "Other" remainder - it is a summary strip, not a report.
TOP_PRODUCT_LIMIT = 3
TOP_CATEGORY_LIMIT = 3
OTHER_CATEGORY_LABEL = "Other"
UNCATEGORISED_LABEL = "Uncategorised"

# The Recent Orders table paginates client-side over one fetched page, so this
# is how many orders that page holds - "recent", not "all".
RECENT_ORDERS_LIMIT = 50
RECENT_ORDERS_MAX = 200
# outstanding_amount and per_delivered are floats; compare with a little slack
# rather than against exact 0 / 100.
AMOUNT_TOLERANCE = 0.005
DELIVERED_TOLERANCE = 0.01


def _has_channel_field():
	return bool(frappe.db.has_column("Sales Order", CHANNEL_FIELD))


def _normalise_channel(channel):
	"""None/""/"all" all mean every channel - "all" is the literal value the
	UI's channel select uses for its default option."""
	if not channel or channel == "all":
		return None
	return channel if _has_channel_field() else None


def _channel_condition(channel, alias="so"):
	"""SQL condition (no leading `and`) restricting `alias` to one channel, or
	None when unfiltered. Pass the result through the caller's condition list."""
	if not channel:
		return None
	return f"{alias}.`{CHANNEL_FIELD}` = %(channel)s"


def _period_bounds(period):
	"""(previous window start, current window start) for trailing windows of
	PERIOD_DAYS length - the current window runs [start, now]."""
	days = PERIOD_DAYS.get(period)
	if not days:
		frappe.throw(frappe._("Invalid period: {0}").format(period))
	start = add_days(getdate(nowdate()), -days)
	return add_days(start, -days), start


def _sales_window(start, end, channel, docstatus=None):
	"""Count + sum(grand_total) of Sales Orders booked in [start, end) by
	transaction_date - end=None means unbounded (up to now).

	docstatus=None counts anything that was ever actually placed - submitted (1)
	or since cancelled (2) - but not drafts, matching how the Sales Orders page
	counts "Total Orders". Pass docstatus=1 for money figures: a cancelled
	order's grand_total is not revenue.
	"""
	conditions = ["so.transaction_date >= %(start)s"]
	params = {"start": start, "end": end, "channel": channel}

	if end:
		conditions.append("so.transaction_date < %(end)s")
	if docstatus is None:
		conditions.append("so.docstatus in (1, 2)")
	else:
		conditions.append("so.docstatus = %(docstatus)s")
		params["docstatus"] = docstatus

	channel_condition = _channel_condition(channel)
	if channel_condition:
		conditions.append(channel_condition)

	row = frappe.db.sql(
		f"""
		select count(*) as cnt, coalesce(sum(so.grand_total), 0) as total
		from `tabSales Order` so
		where {" and ".join(conditions)}
		""",
		params,
		as_dict=True,
	)
	return {"count": int(row[0].cnt or 0), "total": float(row[0].total or 0)}


def _new_customers(start, end, channel):
	"""Customers *acquired* in [start, end): those whose earliest submitted
	Sales Order falls inside the window.

	Deliberately not `count(Customer where creation in window)` - that ignores
	the channel filter entirely (Customer carries no channel) and counts records
	created by an import as if they were won. First-order-date is channel-aware:
	under a channel filter this reads as "first order in that channel".
	"""
	conditions = ["so.docstatus = 1"]
	params = {"start": start, "end": end, "channel": channel}

	channel_condition = _channel_condition(channel)
	if channel_condition:
		conditions.append(channel_condition)

	having = ["min(so.transaction_date) >= %(start)s"]
	if end:
		having.append("min(so.transaction_date) < %(end)s")

	row = frappe.db.sql(
		f"""
		select count(*) as cnt from (
			select so.customer
			from `tabSales Order` so
			where {" and ".join(conditions)}
			group by so.customer
			having {" and ".join(having)}
		) first_orders
		""",
		params,
		as_dict=True,
	)
	return int(row[0].cnt or 0)


def _return_requests(start, end, channel):
	"""Submitted credit notes (Sales Invoice with is_return=1) posted in
	[start, end) - ERPNext has no "return request" document, and a credit note is
	the closest thing that always exists.

	Sales Invoice carries no channel field, so under a channel filter a return is
	attributed via the Sales Order its lines were billed against; a credit note
	with no order link is then excluded.
	"""
	conditions = ["si.docstatus = 1", "si.is_return = 1", "si.posting_date >= %(start)s"]
	params = {"start": start, "end": end, "channel": channel}

	if end:
		conditions.append("si.posting_date < %(end)s")
	if channel:
		conditions.append(
			f"""exists (
				select 1
				from `tabSales Invoice Item` sii
				inner join `tabSales Order` so on so.name = sii.sales_order
				where sii.parent = si.name and so.`{CHANNEL_FIELD}` = %(channel)s
			)"""
		)

	row = frappe.db.sql(
		f"""
		select count(*) as cnt
		from `tabSales Invoice` si
		where {" and ".join(conditions)}
		""",
		params,
		as_dict=True,
	)
	return int(row[0].cnt or 0)


def _audit_accuracy(reconciliation):
	"""% of one audit's counted lines where the count matched what the system
	already held. None when the audit counted nothing."""
	row = frappe.db.sql(
		"""
		select
			count(*) as total,
			sum(case when abs(coalesce(qty, 0) - coalesce(current_qty, 0)) < %(tolerance)s then 1 else 0 end) as matched
		from `tabStock Reconciliation Item`
		where parent = %(parent)s
		""",
		{"parent": reconciliation, "tolerance": QTY_TOLERANCE},
		as_dict=True,
	)
	total = int(row[0].total or 0)
	if not total:
		return None
	return round(float(row[0].matched or 0) * 100.0 / total, 1)


def _stock_accuracy():
	"""Accuracy of the two most recent stock audits, so the card can read
	"x% ... vs last audit".

	Scoped to audits rather than the dashboard's period/channel on purpose: a
	stock count is not a channel event, and pinning it to a 1D window would
	blank the card on every day nobody counted. `purpose = 'Stock
	Reconciliation'` excludes Opening Stock entries, which are seeding, not
	counting. Returns None when the site has never submitted an audit -
	callers render an empty state instead of a fabricated 0%.
	"""
	if not frappe.has_permission("Stock Reconciliation", "read"):
		return None

	audits = frappe.db.sql(
		"""
		select name, posting_date
		from `tabStock Reconciliation`
		where docstatus = 1 and purpose = 'Stock Reconciliation'
		order by posting_date desc, posting_time desc, creation desc
		limit 2
		""",
		as_dict=True,
	)
	if not audits:
		return None

	current = _audit_accuracy(audits[0].name)
	if current is None:
		return None

	return {
		"current": current,
		"previous": _audit_accuracy(audits[1].name) if len(audits) > 1 else None,
		"audit_date": str(audits[0].posting_date),
	}


def _safe_avg(total, count):
	return float(total / count) if count else 0.0


@frappe.whitelist()
def get_dashboard_overview(period="1M", channel=None):
	"""The six home-dashboard KPI cards in one call, each as {current, previous}
	for the period-over-period badge.

	`return_requests` is None when the user cannot read Sales Invoice, and
	`stock_accuracy` when there is no audit history (or no Stock Reconciliation
	permission) - the strip renders those cards as empty rather than as zero.
	"""
	frappe.has_permission("Sales Order", "read", throw=True)
	channel = _normalise_channel(channel)
	prev_start, start = _period_bounds(period)

	current_placed = _sales_window(start, None, channel)
	previous_placed = _sales_window(prev_start, start, channel)

	current_active = _sales_window(start, None, channel, docstatus=1)
	previous_active = _sales_window(prev_start, start, channel, docstatus=1)

	returns_current = _return_requests(start, None, channel) if frappe.has_permission("Sales Invoice", "read") else None
	returns_previous = (
		_return_requests(prev_start, start, channel) if returns_current is not None else None
	)

	return {
		"period": period,
		"channel": channel,
		"total_sales": {"current": current_active["total"], "previous": previous_active["total"]},
		"total_orders": {"current": current_placed["count"], "previous": previous_placed["count"]},
		"customer_growth": {
			"current": _new_customers(start, None, channel),
			"previous": _new_customers(prev_start, start, channel),
		},
		"average_order": {
			"current": _safe_avg(current_active["total"], current_active["count"]),
			"previous": _safe_avg(previous_active["total"], previous_active["count"]),
		},
		"return_requests": (
			None if returns_current is None else {"current": returns_current, "previous": returns_previous}
		),
		"stock_accuracy": _stock_accuracy(),
	}


@frappe.whitelist()
def get_sales_channels():
	"""Channel values actually present on existing Sales Orders - like
	get_order_statuses(), deliberately not a static list, so the select never
	offers a channel this site has no orders for. Empty on a site without the
	connectors' `sales_channel` field, which the UI reads as "no channel
	filtering available"."""
	frappe.has_permission("Sales Order", "read", throw=True)
	if not _has_channel_field():
		return []

	return [
		row[0]
		for row in frappe.db.sql(
			f"""
			select distinct `{CHANNEL_FIELD}`
			from `tabSales Order`
			where docstatus in (1, 2) and coalesce(`{CHANNEL_FIELD}`, '') != ''
			order by `{CHANNEL_FIELD}` asc
			"""
		)
	]


def _invoice_state(order_names):
	"""Per order: whether a credit note exists against it, and how much of what
	was invoiced is still outstanding.

	Distinct at invoice level - the link lives on Sales Invoice Item, so a
	multi-line invoice would otherwise be counted (and its outstanding summed)
	once per line. Empty when the user cannot read Sales Invoice, which leaves
	every order reading as Pending rather than leaking a status they can't see.
	"""
	if not frappe.has_permission("Sales Invoice", "read"):
		return {}

	rows = frappe.db.sql(
		"""
		select distinct
			sii.sales_order as order_name,
			si.name as invoice,
			si.is_return,
			si.outstanding_amount
		from `tabSales Invoice Item` sii
		inner join `tabSales Invoice` si on si.name = sii.parent
		where si.docstatus = 1
		  and ifnull(sii.sales_order, '') != ''
		  and sii.sales_order in %(names)s
		""",
		{"names": tuple(order_names)},
		as_dict=True,
	)

	state = {}
	for row in rows:
		entry = state.setdefault(row.order_name, {"has_return": False, "invoiced": 0, "outstanding": 0.0})
		if row.is_return:
			entry["has_return"] = True
			continue
		entry["invoiced"] += 1
		entry["outstanding"] += float(row.outstanding_amount or 0)
	return state


def _returned_orders(order_names):
	"""Orders with at least one submitted return Delivery Note against them."""
	if not frappe.has_permission("Delivery Note", "read"):
		return set()

	rows = frappe.db.sql(
		"""
		select distinct dni.against_sales_order as order_name
		from `tabDelivery Note Item` dni
		inner join `tabDelivery Note` dn on dn.name = dni.parent
		where dn.docstatus = 1 and dn.is_return = 1
		  and ifnull(dni.against_sales_order, '') != ''
		  and dni.against_sales_order in %(names)s
		""",
		{"names": tuple(order_names)},
	)
	return {row[0] for row in rows}


def _payment_state(entry):
	"""Refunded beats everything - a credit note against the order is the thing
	worth surfacing. An order with no invoice at all simply isn't billed yet,
	which reads as Pending rather than as a third state the card can't render."""
	if entry and entry["has_return"]:
		return "Refunded"
	if not entry or not entry["invoiced"]:
		return "Pending"
	return "Paid" if entry["outstanding"] <= AMOUNT_TOLERANCE else "Pending"


def _fulfillment_state(order, returned):
	if order.name in returned:
		return "Returned"
	return "Fulfilled" if float(order.per_delivered or 0) >= 100 - DELIVERED_TOLERANCE else "Unfulfilled"


@frappe.whitelist()
def get_recent_orders(channel=None, limit=RECENT_ORDERS_LIMIT):
	"""The Recent Orders table: the most recently created submitted Sales
	Orders, each with the payment and fulfillment state the card's badges need.

	Deliberately not period-scoped. The dashboard's period toggle goes down to
	1D, which would routinely empty a table whose whole point is "latest
	activity" - an empty table reads as broken rather than as filtered. It does
	honour the channel filter.

	Payment is derived from the linked Sales Invoices rather than the order's
	own per_billed, because per_billed means *invoiced*, not paid: a fully
	invoiced but unpaid order would otherwise show as Paid. Fulfillment uses
	per_delivered, which ERPNext maintains from Delivery Notes, with a submitted
	return Delivery Note overriding it as Returned.
	"""
	frappe.has_permission("Sales Order", "read", throw=True)
	channel = _normalise_channel(channel)
	limit = max(1, min(cint(limit) or RECENT_ORDERS_LIMIT, RECENT_ORDERS_MAX))

	conditions = ["so.docstatus = 1"]
	channel_condition = _channel_condition(channel)
	if channel_condition:
		conditions.append(channel_condition)

	orders = frappe.db.sql(
		f"""
		select
			so.name, so.creation, so.customer, so.customer_name,
			so.grand_total, so.currency, so.total_qty, so.per_delivered
		from `tabSales Order` so
		where {" and ".join(conditions)}
		order by so.creation desc
		limit %(limit)s
		""",
		{"channel": channel, "limit": limit},
		as_dict=True,
	)
	if not orders:
		return {"channel": channel, "orders": []}

	names = [order.name for order in orders]
	invoices = _invoice_state(names)
	returned = _returned_orders(names)

	return {
		"channel": channel,
		"orders": [
			{
				"name": order.name,
				"creation": str(order.creation),
				"customer_name": order.customer_name or order.customer,
				"grand_total": float(order.grand_total or 0),
				"currency": order.currency,
				"item_count": float(order.total_qty or 0),
				"payment": _payment_state(invoices.get(order.name)),
				"fulfillment": _fulfillment_state(order, returned),
			}
			for order in orders
		],
	}


def _root_item_group():
	"""The Item Group tree's root - the row with no parent, the same definition
	item_group.get_children() uses for is_root. None on a site with no tree at
	all, which collapses every category to Uncategorised rather than erroring."""
	row = frappe.db.sql("select name from `tabItem Group` where ifnull(parent_item_group, '') = '' order by lft limit 1")
	return row[0][0] if row else None


# Submitted Sales Order lines with each item rolled up to its *top-level* Item
# Group. Item Group is a nested set, so `tl` - the category - is the group whose
# parent is the tree root and whose [lft, rgt] range contains the item's own
# group: "Shirts" and "Jackets" both roll up to "Apparel". An item already
# sitting in a top-level group matches itself; one with no group, a missing Item
# row, or a group that *is* the root falls through to Uncategorised.
SOLD_LINES_FROM = """
	`tabSales Order Item` soi
	inner join `tabSales Order` so on so.name = soi.parent
	left join `tabItem` i on i.name = soi.item_code
	left join `tabItem Group` ig on ig.name = i.item_group
	left join `tabItem Group` tl on tl.parent_item_group = %(root)s and ig.lft between tl.lft and tl.rgt
"""

CATEGORY_EXPR = "coalesce(tl.name, %(uncategorised)s)"


def _sold_lines_where(channel):
	conditions = ["so.docstatus = 1", "so.transaction_date >= %(start)s"]
	channel_condition = _channel_condition(channel)
	if channel_condition:
		conditions.append(channel_condition)
	return " and ".join(conditions)


@frappe.whitelist()
def get_top_products(period="1M", channel=None, limit=TOP_PRODUCT_LIMIT):
	"""The Top Products card: the best-selling products of the period, the
	category split behind them, and the share of sales they account for.

	Ranked by revenue rather than units - the card puts a "Share" column next to
	a currency "Sales" column, and the two should measure the same thing. (The
	older item_stats.get_top_sku ranks by qty; this deliberately differs.)

	Shares are a percentage of *line-level* sales (sum of Sales Order Item
	amounts) for the same window, so every share on the card sums consistently.
	That denominator is slightly below the Total Sales KPI above it, which uses
	order-level grand_total and so includes tax and shipping.

	`categories` is the top TOP_CATEGORY_LIMIT at their true share plus an
	"Other" remainder, so the bar fills its width without any segment lying
	about how big it is.
	"""
	frappe.has_permission("Sales Order", "read", throw=True)
	channel = _normalise_channel(channel)
	limit = max(1, cint(limit) or TOP_PRODUCT_LIMIT)
	_, start = _period_bounds(period)

	params = {
		"start": start,
		"channel": channel,
		"root": _root_item_group(),
		"uncategorised": UNCATEGORISED_LABEL,
		"limit": limit,
	}
	where = _sold_lines_where(channel)
	empty = {"period": period, "channel": channel, "total_sales": 0.0, "top_share": 0.0,
	         "categories": [], "products": []}

	category_rows = frappe.db.sql(
		f"""
		select {CATEGORY_EXPR} as category, coalesce(sum(soi.amount), 0) as amount
		from {SOLD_LINES_FROM}
		where {where}
		group by {CATEGORY_EXPR}
		order by amount desc
		""",
		params,
		as_dict=True,
	)

	total = sum(float(row.amount or 0) for row in category_rows)
	if total <= 0:
		return empty

	def share(amount):
		return round(amount * 100.0 / total, 1)

	categories = [
		{"name": row.category, "amount": float(row.amount or 0), "share": share(float(row.amount or 0)),
		 "is_other": False}
		for row in category_rows[:TOP_CATEGORY_LIMIT]
	]
	remainder = total - sum(category["amount"] for category in categories)
	# Guard the float dust left by summing line amounts, so an exhaustively
	# covered bar doesn't sprout a 0.0% "Other" sliver.
	if remainder > 0.005:
		categories.append(
			{"name": OTHER_CATEGORY_LABEL, "amount": remainder, "share": share(remainder), "is_other": True}
		)

	product_rows = frappe.db.sql(
		f"""
		select
			soi.item_code,
			coalesce(i.item_name, soi.item_code) as item_name,
			{CATEGORY_EXPR} as category,
			coalesce(sum(soi.amount), 0) as amount
		from {SOLD_LINES_FROM}
		where {where}
		group by soi.item_code, coalesce(i.item_name, soi.item_code), {CATEGORY_EXPR}
		order by amount desc
		limit %(limit)s
		""",
		params,
		as_dict=True,
	)

	products = [
		{
			"item_code": row.item_code,
			"item_name": row.item_name,
			"category": row.category,
			"amount": float(row.amount or 0),
			"share": share(float(row.amount or 0)),
		}
		for row in product_rows
	]

	return {
		"period": period,
		"channel": channel,
		"total_sales": total,
		"top_share": round(sum(product["share"] for product in products), 1),
		"categories": categories,
		"products": products,
	}


def _trend_months(today):
	"""The TREND_MONTHS (year, month) pairs ending with today's month, oldest
	first."""
	months = []
	year, month = today.year, today.month
	for _ in range(TREND_MONTHS):
		months.append((year, month))
		month -= 1
		if month == 0:
			year, month = year - 1, 12
	return list(reversed(months))


def _bucket_case(field):
	"""SQL CASE mapping a date to its TREND_DAY_BUCKETS index - the last bucket
	is the `else`, so it absorbs the 29th-31st of long months."""
	whens = " ".join(f"when day({field}) <= {end} then {index}" for index, (_, end) in enumerate(TREND_DAY_BUCKETS[:-1]))
	return f"case {whens} else {len(TREND_DAY_BUCKETS) - 1} end"


def _trend_rows(start, channel, select, table_and_joins):
	bucket = _bucket_case("so.transaction_date")
	conditions = ["so.docstatus = 1", "so.transaction_date >= %(start)s"]

	channel_condition = _channel_condition(channel)
	if channel_condition:
		conditions.append(channel_condition)

	return frappe.db.sql(
		f"""
		select
			year(so.transaction_date) as yr,
			month(so.transaction_date) as mo,
			{bucket} as bucket,
			{select}
		from {table_and_joins}
		where {" and ".join(conditions)}
		group by year(so.transaction_date), month(so.transaction_date), {bucket}
		""",
		{"start": start, "channel": channel},
		as_dict=True,
	)


@frappe.whitelist()
def get_sales_trend(channel=None):
	"""Revenue and profit for the Sales Overview chart: a rolling TREND_MONTHS
	months, each split into TREND_DAY_BUCKETS day-ranges.

	`revenue` is grand_total, so the chart's totals reconcile with the Total
	Sales card. `profit` is net_total minus COGS - tax and shipping are stripped
	from the margin because neither is profit. COGS uses the valuation rate
	ERPNext stamped on the order line, falling back to the Item's current
	valuation rate for lines it left at 0 (non-stock items land at 0 COGS and so
	read as pure margin).

	Each point's `period` is pre-labelled "Aug 25 01-05" - the chart's axis and
	tooltip parse that shape directly. Buckets that have not started yet are
	omitted rather than sent as zeroes, so the current month's line stops at
	today instead of falling off a cliff.
	"""
	frappe.has_permission("Sales Order", "read", throw=True)
	channel = _normalise_channel(channel)

	today = getdate(nowdate())
	months = _trend_months(today)
	start = getdate(f"{months[0][0]}-{months[0][1]:02d}-01")

	revenue_rows = _trend_rows(
		start,
		channel,
		"coalesce(sum(so.grand_total), 0) as revenue, coalesce(sum(so.net_total), 0) as net",
		"`tabSales Order` so",
	)
	cogs_rows = _trend_rows(
		start,
		channel,
		"""coalesce(sum(
			coalesce(nullif(soi.valuation_rate, 0), i.valuation_rate, 0)
			* coalesce(nullif(soi.stock_qty, 0), soi.qty, 0)
		), 0) as cogs""",
		"""`tabSales Order Item` soi
			inner join `tabSales Order` so on so.name = soi.parent
			left join `tabItem` i on i.name = soi.item_code""",
	)

	revenue_by_key = {(r.yr, r.mo, r.bucket): r for r in revenue_rows}
	cogs_by_key = {(r.yr, r.mo, r.bucket): float(r.cogs or 0) for r in cogs_rows}

	points = []
	for year, month in months:
		is_current_month = (year, month) == (today.year, today.month)
		for index, (bucket_start, bucket_end) in enumerate(TREND_DAY_BUCKETS):
			if is_current_month and bucket_start > today.day:
				continue

			row = revenue_by_key.get((year, month, index))
			net = float(row.net or 0) if row else 0.0
			points.append(
				{
					"period": f"{calendar.month_abbr[month]} {year % 100:02d} {bucket_start:02d}-{bucket_end:02d}",
					"revenue": float(row.revenue or 0) if row else 0.0,
					"profit": net - cogs_by_key.get((year, month, index), 0.0),
				}
			)

	return {"channel": channel, "points": points}
