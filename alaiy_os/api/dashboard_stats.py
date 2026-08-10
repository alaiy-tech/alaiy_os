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
from frappe.utils import add_days, getdate, nowdate

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
