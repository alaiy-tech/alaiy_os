import frappe
from frappe.utils import add_days, getdate, nowdate

PERIOD_DAYS = {"1D": 1, "1W": 7, "1M": 30, "1Y": 365}


def _period_bounds(period):
	days = PERIOD_DAYS.get(period)
	if not days:
		frappe.throw(frappe._("Invalid period: {0}").format(period))
	today = getdate(nowdate())
	start = add_days(today, -days)
	prev_start = add_days(start, -days)
	return prev_start, start


def _order_totals(start, end=None, docstatus=None):
	"""Count + sum(grand_total) of Sales Orders booked in [start, end) by
	transaction_date - end=None means unbounded (up to now)."""
	conditions = ["so.transaction_date >= %(start)s"]
	params = {"start": start}
	if end:
		conditions.append("so.transaction_date < %(end)s")
		params["end"] = end
	if docstatus is not None:
		conditions.append("so.docstatus = %(docstatus)s")
		params["docstatus"] = docstatus
	else:
		# "Total Orders" counts anything that was ever actually placed -
		# submitted (1) or since cancelled (2) - not drafts (0).
		conditions.append("so.docstatus in (1, 2)")

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


def _safe_avg(total, count):
	return float(total / count) if count else 0.0


@frappe.whitelist()
def get_sales_orders_overview(period="1M"):
	"""The four Sales Orders KPI cards (total orders, total order value,
	average order value, cancelled orders) in one call, each as
	{current, previous} for the period-over-period % badge.

	Total order value and AOV are computed from submitted (docstatus=1)
	orders only - a cancelled order's grand_total isn't real revenue, so
	including it would inflate both figures.
	"""
	frappe.has_permission("Sales Order", "read", throw=True)
	prev_start, start = _period_bounds(period)

	current_all = _order_totals(start)
	previous_all = _order_totals(prev_start, start)

	current_active = _order_totals(start, docstatus=1)
	previous_active = _order_totals(prev_start, start, docstatus=1)

	current_cancelled = _order_totals(start, docstatus=2)
	previous_cancelled = _order_totals(prev_start, start, docstatus=2)

	return {
		"period": period,
		"total_orders": {"current": current_all["count"], "previous": previous_all["count"]},
		"total_order_value": {"current": current_active["total"], "previous": previous_active["total"]},
		"average_order_value": {
			"current": _safe_avg(current_active["total"], current_active["count"]),
			"previous": _safe_avg(previous_active["total"], previous_active["count"]),
		},
		"cancelled_orders": {"current": current_cancelled["count"], "previous": previous_cancelled["count"]},
	}


@frappe.whitelist()
def get_order_statuses():
	"""Distinct `status` values actually present on existing Sales Orders -
	deliberately not the full static list of every status the doctype's
	Select field could ever hold, since a site may not have orders in every
	status yet and an empty dropdown option is worse than a short one."""
	frappe.has_permission("Sales Order", "read", throw=True)
	return frappe.get_all("Sales Order", pluck="status", distinct=True, order_by="status asc")
