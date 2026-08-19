import frappe
from frappe.utils import add_days, cint, getdate, nowdate

# "Sold" is read from Sales Order (booked/committed), not Sales Invoice or
# Delivery Note - a deliberate choice, not the only valid one, for what
# counts as a unit "sold" on the Products KPI strip.
PERIOD_DAYS = {"1D": 1, "1W": 7, "1M": 30, "1Y": 365}

# At or below this many units on hand (summed across warehouses) an item counts
# as "low stock" rather than "in stock" on the dashboard's Inventory gauge.
LOW_STOCK_QTY = 10

# On-hand history is reconstructed from Stock Ledger Entry (there's no
# materialized daily snapshot), which is one window-function query per
# sample point - kept coarser for 1Y so a full year doesn't mean 365
# separate table scans.
ON_HAND_PERIOD_CONFIG = {
	"1W": {"days_back": 7, "step_days": 1},
	"1M": {"days_back": 30, "step_days": 1},
	"1Y": {"days_back": 365, "step_days": 7},
}


def _period_start(period):
	days = PERIOD_DAYS.get(period)
	if not days:
		frappe.throw(frappe._("Invalid period: {0}").format(period))
	return add_days(nowdate(), -days)


@frappe.whitelist()
def get_units_sold(period="1M"):
	frappe.has_permission("Sales Order", "read", throw=True)
	start = _period_start(period)

	total = frappe.db.sql(
		"""
		select coalesce(sum(soi.qty), 0)
		from `tabSales Order Item` soi
		inner join `tabSales Order` so on so.name = soi.parent
		where so.docstatus = 1 and so.transaction_date >= %(start)s
		""",
		{"start": start},
	)[0][0]

	return {"period": period, "units_sold": float(total or 0)}


@frappe.whitelist()
def get_stock_mix():
	"""Out of stock (<=0) / low stock (<=LOW_STOCK_QTY) / in stock (above it),
	counted per Item summed across all warehouses. Stock items with no Bin row
	at all (never transacted) are still counted, as 0 on-hand.

	The bucketing is deliberately done in SQL, not in Python. The inner query is
	one row per Item, so on a large catalog that result set *is* the cost of this
	call - transferring millions of rows and building a dict for each one, to
	end up with three integers. Aggregating outside the subquery returns exactly
	one row whatever the catalog size.
	"""
	frappe.has_permission("Item", "read", throw=True)

	row = frappe.db.sql(
		"""
		select
			coalesce(sum(case when q.qty <= 0 then 1 else 0 end), 0) as out_of_stock,
			coalesce(sum(case when q.qty > 0 and q.qty <= %(low)s then 1 else 0 end), 0) as low_stock,
			coalesce(sum(case when q.qty > %(low)s then 1 else 0 end), 0) as in_stock
		from (
			select i.item_code, coalesce(sum(b.actual_qty), 0) as qty
			from `tabItem` i
			left join `tabBin` b on b.item_code = i.item_code
			where i.is_stock_item = 1 and i.disabled = 0
			group by i.item_code
		) q
		""",
		{"low": LOW_STOCK_QTY},
		as_dict=True,
	)

	if not row:
		return {"out_of_stock": 0, "low_stock": 0, "in_stock": 0}

	return {
		"out_of_stock": cint(row[0].out_of_stock),
		"low_stock": cint(row[0].low_stock),
		"in_stock": cint(row[0].in_stock),
	}


def _on_hand_as_of(date):
	"""Sum of the latest qty_after_transaction per (item, warehouse) as of
	`date`, across every item/warehouse - i.e. total company-wide on-hand
	units at that point in time."""
	row = frappe.db.sql(
		"""
		select coalesce(sum(t.qty_after_transaction), 0) as qty
		from (
			select sle.qty_after_transaction,
			       row_number() over (
			           partition by sle.item_code, sle.warehouse
			           order by sle.posting_date desc, sle.posting_time desc, sle.creation desc
			       ) as rn
			from `tabStock Ledger Entry` sle
			where sle.is_cancelled = 0 and sle.posting_date <= %(date)s
		) t
		where t.rn = 1
		""",
		{"date": date},
		as_dict=True,
	)
	return float(row[0].qty or 0) if row else 0.0


@frappe.whitelist()
def get_on_hand_trend(period="1M"):
	frappe.has_permission("Item", "read", throw=True)
	config = ON_HAND_PERIOD_CONFIG.get(period)
	if not config:
		frappe.throw(frappe._("Invalid period: {0}").format(period))

	today = getdate(nowdate())
	start = add_days(today, -config["days_back"])

	points = []
	d = start
	while d < today:
		points.append(d)
		d = add_days(d, config["step_days"])
	points.append(today)

	return {
		"period": period,
		"points": [{"date": str(p), "on_hand": _on_hand_as_of(p)} for p in points],
	}


def _sales_totals(start, end=None):
	"""Sum of qty/amount booked on submitted Sales Orders in [start, end) -
	end=None means unbounded (up to now), for the "current period" window."""
	conditions = "so.docstatus = 1 and so.transaction_date >= %(start)s"
	if end:
		conditions += " and so.transaction_date < %(end)s"

	row = frappe.db.sql(
		f"""
		select coalesce(sum(soi.qty), 0) as qty, coalesce(sum(soi.amount), 0) as amount
		from `tabSales Order Item` soi
		inner join `tabSales Order` so on so.name = soi.parent
		where {conditions}
		""",
		{"start": start, "end": end},
		as_dict=True,
	)
	return {"qty": float(row[0].qty or 0), "amount": float(row[0].amount or 0)}


def _safe_avg(amount, qty):
	return float(amount / qty) if qty else 0.0


@frappe.whitelist()
def get_products_overview(period="1M"):
	"""The four Products KPI cards (units sold, on-hand units, average unit
	value, active SKUs) in one call, each as {current, previous} for the
	period-over-period comparison the cards render as a % badge.

	"Previous" is the immediately preceding window of the same length, except
	for active_skus - there's no historical enabled/disabled log, so its
	"previous" is approximated as active items that already existed
	(creation <= period start), i.e. the delta reads as "new active SKUs
	added this period" rather than a true point-in-time snapshot.
	"""
	frappe.has_permission("Item", "read", throw=True)
	days = PERIOD_DAYS.get(period)
	if not days:
		frappe.throw(frappe._("Invalid period: {0}").format(period))

	today = getdate(nowdate())
	period_start = add_days(today, -days)
	prev_start = add_days(period_start, -days)

	current_sales = _sales_totals(period_start)
	previous_sales = _sales_totals(prev_start, period_start)

	on_hand_now = _on_hand_as_of(today)
	on_hand_before = _on_hand_as_of(period_start)

	# One pass over the enabled items, not two. As two `frappe.db.count` calls
	# these were separate full scans of `tabItem` differing only in the
	# `creation` bound, which on a large catalog is two scans too many.
	active = frappe.db.sql(
		"""
		select
			count(*) as active_now,
			coalesce(sum(case when creation <= %(period_start)s then 1 else 0 end), 0) as active_before
		from `tabItem`
		where disabled = 0
		""",
		{"period_start": period_start},
		as_dict=True,
	)
	active_now = cint(active[0].active_now) if active else 0
	active_before = cint(active[0].active_before) if active else 0

	return {
		"period": period,
		"units_sold": {"current": current_sales["qty"], "previous": previous_sales["qty"]},
		"on_hand_units": {"current": on_hand_now, "previous": on_hand_before},
		"average_unit_value": {
			"current": _safe_avg(current_sales["amount"], current_sales["qty"]),
			"previous": _safe_avg(previous_sales["amount"], previous_sales["qty"]),
		},
		"active_skus": {"current": active_now, "previous": active_before},
	}


@frappe.whitelist()
def get_top_sku(period="1M", limit=1):
	frappe.has_permission("Sales Order", "read", throw=True)
	start = _period_start(period)
	limit = cint(limit) or 1

	rows = frappe.db.sql(
		"""
		select soi.item_code, sum(soi.qty) as qty, sum(soi.amount) as amount
		from `tabSales Order Item` soi
		inner join `tabSales Order` so on so.name = soi.parent
		where so.docstatus = 1 and so.transaction_date >= %(start)s
		group by soi.item_code
		order by qty desc
		limit %(limit)s
		""",
		{"start": start, "limit": limit},
		as_dict=True,
	)

	if not rows:
		return {"period": period, "items": []}

	items_by_code = {
		i.item_code: i
		for i in frappe.get_all(
			"Item",
			filters={"item_code": ["in", [r.item_code for r in rows]]},
			fields=["item_code", "item_name", "image"],
		)
	}

	return {
		"period": period,
		"items": [
			{
				"item_code": r.item_code,
				"item_name": items_by_code.get(r.item_code, {}).get("item_name", r.item_code),
				"image": items_by_code.get(r.item_code, {}).get("image"),
				"qty_sold": float(r.qty or 0),
				"amount": float(r.amount or 0),
			}
			for r in rows
		],
	}
