"""
Orders API — whitelisted methods for the Orders screen.

Call from frontend: frappe.call('alaiy_os_core.api.orders.<method>', args)
"""

from __future__ import annotations

import frappe
from frappe import _


@frappe.whitelist()
def get_orders(
	channel: str | None = None,
	status: str | None = None,
	search: str | None = None,
	page: int = 1,
	page_size: int = 25,
) -> dict:
	"""Return a paginated list of Sales Orders with channel metadata."""
	filters: dict = {"docstatus": 1}
	if channel:
		filters["custom_channel"] = channel
	if status:
		filters["custom_channel_status"] = status

	if search:
		filters["name"] = ("like", f"%{search}%")

	total = frappe.db.count("Sales Order", filters)
	orders = frappe.get_all(
		"Sales Order",
		filters=filters,
		fields=[
			"name",
			"customer",
			"transaction_date",
			"grand_total",
			"currency",
			"custom_channel as channel",
			"custom_channel_order_id as channel_order_id",
			"custom_channel_status as channel_status",
			"custom_fulfillment_status as fulfillment_status",
		],
		order_by="transaction_date desc",
		limit=page_size,
		start=(page - 1) * page_size,
	)
	return {"orders": orders, "total": total, "page": page, "page_size": page_size}


@frappe.whitelist()
def get_order(sales_order_id: str) -> dict:
	"""Return full details for a single Sales Order."""
	so = frappe.get_doc("Sales Order", sales_order_id)
	return so.as_dict()


@frappe.whitelist()
def sync_orders(channel: str | None = None) -> dict:
	"""Trigger an order sync from the channel (background job)."""
	from alaiy_os_core.services.orders import OrderService

	frappe.enqueue(
		method=OrderService().sync_orders,
		queue="long",
		channel=channel,
		job_name=f"sync_orders_{channel or 'default'}",
	)
	return {"message": _("Order sync queued")}


@frappe.whitelist()
def fulfill_order(sales_order_id: str, tracking_number: str, carrier: str) -> dict:
	"""Fulfill an order — creates Delivery Note and updates the channel."""
	from alaiy_os_core.services.fulfillment import FulfillmentService

	return FulfillmentService().fulfill(sales_order_id)
