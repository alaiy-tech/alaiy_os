import frappe
from frappe.utils import add_days, date_diff, getdate, nowdate

# An order past its delivery date is only worth flagging while it can still be
# delivered. Completed and Cancelled are the two states the Sales Orders page
# treats as closed out; anything else (Draft, To Deliver, On Hold, ...) still
# counts as an overdue delivery.
SETTLED_STATUSES = ["Completed", "Cancelled"]

DATE_FIELD = "transaction_date"


@frappe.whitelist()
def get_sales_orders_summary(filters=None, or_filters=None, from_date=None, to_date=None):
	"""The four Sales Orders KPI cards for whatever the list is currently
	showing, in one call.

	`filters`/`or_filters` are the same conditions the page sends to the list
	query, so every card describes exactly the rows in the table beneath it -
	including the status tab. That equivalence is the point: a KPI that
	silently applied its own docstatus rules would disagree with the row count
	right below it, and the user has no way to tell which one to believe. It
	also means the Cancelled tab reports cancelled GMV rather than nothing,
	which is the honest reading of "value of what I'm looking at".

	`from_date`/`to_date` are passed separately from the filters they already
	appear in, because the comparison figures need the window's length: the
	previous period is the equally-long stretch ending the day before it. With
	no date range picked there's nothing to compare against, so `previous`
	comes back null and the page drops the trend badge rather than inventing
	a baseline.
	"""
	frappe.has_permission("Sales Order", "read", throw=True)

	filters = _parse_list(filters)
	or_filters = _parse_list(or_filters)

	current = _window_summary(filters, or_filters, from_date, to_date)

	previous_from, previous_to = _previous_window(from_date, to_date)
	previous = _window_summary(filters, or_filters, previous_from, previous_to) if previous_from else None

	return {
		"total_orders": _pair(current, previous, "count"),
		"total_gmv": _pair(current, previous, "total"),
		"average_order_value": _pair(current, previous, "average"),
		"past_due_deliveries": _pair(current, previous, "past_due"),
	}


@frappe.whitelist()
def get_order_statuses():
	"""Distinct `status` values actually present on existing Sales Orders -
	deliberately not the full static list of every status the doctype's
	Select field could ever hold, since a site may not have orders in every
	status yet and an empty dropdown option is worse than a short one."""
	frappe.has_permission("Sales Order", "read", throw=True)
	return frappe.get_all("Sales Order", pluck="status", distinct=True, order_by="status asc")


def _window_summary(filters, or_filters, from_date, to_date):
	"""Count, GMV, average and past-due total over one date window."""
	scoped = _with_window(filters, from_date, to_date)

	# Aggregates go through the dict form: Frappe rejects "count(name)" and
	# friends as raw strings in SELECT.
	totals = frappe.get_all(
		"Sales Order",
		filters=scoped,
		or_filters=or_filters,
		fields=[{"COUNT": "name", "as": "count"}, {"SUM": "grand_total", "as": "total"}],
	)[0]

	# SUM over no rows is NULL, not 0.
	count = int(totals.count or 0)
	total = float(totals.total or 0)

	past_due = frappe.get_all(
		"Sales Order",
		filters=[
			*scoped,
			["delivery_date", "<", nowdate()],
			["status", "not in", SETTLED_STATUSES],
		],
		or_filters=or_filters,
		fields=[{"COUNT": "name", "as": "count"}],
	)[0]

	return {
		"count": count,
		"total": total,
		"average": total / count if count else 0.0,
		"past_due": int(past_due.count or 0),
	}


def _with_window(filters, from_date, to_date):
	"""`filters` with any transaction_date condition swapped for this window.

	The page's own date-range filter is already in `filters`; replacing it here
	is what lets the same filter set be re-run over the previous period without
	the two date conditions contradicting each other.

	With no window to substitute there is nothing to replace, and the caller's
	own date conditions are left alone - stripping them regardless would make
	a date-filtered request silently report on every order ever placed.
	"""
	if not (from_date or to_date):
		return list(filters)

	scoped = [f for f in filters if f[0] != DATE_FIELD]

	if from_date:
		scoped.append([DATE_FIELD, ">=", str(from_date)])
	if to_date:
		scoped.append([DATE_FIELD, "<=", str(to_date)])

	return scoped


def _previous_window(from_date, to_date):
	"""The equally-long window ending the day before `from_date`."""
	if not (from_date and to_date):
		return None, None

	start, end = getdate(from_date), getdate(to_date)
	span = date_diff(end, start) + 1

	previous_to = add_days(start, -1)
	return add_days(previous_to, -(span - 1)), previous_to


def _pair(current, previous, key):
	return {"current": current[key], "previous": previous[key] if previous else None}


def _parse_list(value):
	if isinstance(value, str):
		value = frappe.parse_json(value)
	return list(value or [])
