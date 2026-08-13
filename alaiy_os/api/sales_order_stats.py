import frappe

from alaiy_os.api.list_summary import summarise

# An order past its delivery date is only worth flagging while it can still be
# delivered. Completed and Cancelled are the two states the Sales Orders page
# treats as closed out; anything else (Draft, To Deliver, On Hold, ...) still
# counts as an overdue delivery.
SETTLED_STATUSES = ["Completed", "Cancelled"]

DATE_FIELD = "transaction_date"
OVERDUE_FIELD = "delivery_date"


@frappe.whitelist()
def get_sales_orders_summary(filters=None, or_filters=None, from_date=None, to_date=None):
	"""The four Sales Orders KPI cards for whatever the list is currently
	showing, in one call. See alaiy_os.api.list_summary.summarise for how the
	window and the previous-period comparison are derived."""
	frappe.has_permission("Sales Order", "read", throw=True)

	metrics = summarise(
		"Sales Order",
		filters,
		or_filters,
		from_date,
		to_date,
		DATE_FIELD,
		OVERDUE_FIELD,
		SETTLED_STATUSES,
	)

	return {
		"total_orders": metrics["count"],
		"total_gmv": metrics["total"],
		"average_order_value": metrics["average"],
		"past_due_deliveries": metrics["past_due"],
	}


@frappe.whitelist()
def get_order_statuses():
	"""Distinct `status` values actually present on existing Sales Orders -
	deliberately not the full static list of every status the doctype's
	Select field could ever hold, since a site may not have orders in every
	status yet and an empty dropdown option is worse than a short one."""
	frappe.has_permission("Sales Order", "read", throw=True)
	return frappe.get_all("Sales Order", pluck="status", distinct=True, order_by="status asc")
