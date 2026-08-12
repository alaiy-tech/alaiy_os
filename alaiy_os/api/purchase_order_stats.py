import frappe

from alaiy_os.api.list_summary import summarise

# A purchase order past its required-by date is only worth flagging while it
# can still be received. Mirrors SETTLED_STATUSES in sales_order_stats.py, and
# the issue's own definition of done ("status is not Completed/Cancelled").
#
# Note this is status-based, not receipt-based: a PO whose lines are all in but
# whose status hasn't moved on still counts as overdue, and Closed - which a
# buyer sets by hand to abandon a PO - deliberately still counts too, exactly
# as Closed does on the Sales Orders page.
SETTLED_STATUSES = ["Completed", "Cancelled"]

DATE_FIELD = "transaction_date"
OVERDUE_FIELD = "schedule_date"


@frappe.whitelist()
def get_purchase_orders_summary(filters=None, or_filters=None, from_date=None, to_date=None):
	"""The four Purchase Orders KPI cards for whatever the list is currently
	showing, in one call. See alaiy_os.api.list_summary.summarise for how the
	window and the previous-period comparison are derived."""
	frappe.has_permission("Purchase Order", "read", throw=True)

	metrics = summarise(
		"Purchase Order",
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
		"total_spend": metrics["total"],
		"average_order_value": metrics["average"],
		"past_due_receipts": metrics["past_due"],
	}


@frappe.whitelist()
def get_order_statuses():
	"""Distinct `status` values actually present on existing Purchase Orders -
	deliberately not the full static list of every status the doctype's
	Select field could ever hold, since a site may not have orders in every
	status yet and an empty dropdown option is worse than a short one."""
	frappe.has_permission("Purchase Order", "read", throw=True)
	return frappe.get_all("Purchase Order", pluck="status", distinct=True, order_by="status asc")
