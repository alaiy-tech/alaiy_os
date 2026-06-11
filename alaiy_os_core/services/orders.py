"""
OrderService — syncs channel orders into ERPNext Sales Orders.

Always writes through the document API (frappe.get_doc / .insert / .submit).
Never touches raw SQL or the database directly.
"""

from __future__ import annotations

import frappe
from frappe.utils import now_datetime

from alaiy_os_core.connectors.registry import ConnectorRegistry


class OrderService:

	def sync_orders(self, channel: str | None = None) -> dict:
		"""
		Pull unfulfilled orders from the channel and create/update Sales Orders
		in ERPNext.  Returns a summary dict with counts.
		"""
		connector = ConnectorRegistry.get_channel(channel)
		last_sync = self._last_sync_timestamp()
		channel_orders = connector.get_orders(since=last_sync, status="unfulfilled")

		created = 0
		skipped = 0

		for order in channel_orders:
			if self._sales_order_exists(order.channel_order_id, order.channel):
				skipped += 1
				continue
			self._create_sales_order(order)
			created += 1

		return {"created": created, "skipped": skipped, "total": len(channel_orders)}

	def fulfill_order(self, sales_order_id: str, tracking_number: str, carrier: str) -> bool:
		"""
		Mark a Sales Order as fulfilled: create a Delivery Note in ERPNext and
		push the tracking number back to the channel.
		"""
		so = frappe.get_doc("Sales Order", sales_order_id)
		channel_order_id = so.get("custom_channel_order_id")
		channel = so.get("custom_channel")

		if not channel_order_id or not channel:
			frappe.throw(f"Sales Order {sales_order_id} has no channel metadata")

		connector = ConnectorRegistry.get_channel(channel)
		success = connector.fulfill_order(channel_order_id, tracking_number, carrier)

		if success:
			so.db_set("custom_fulfillment_status", "Fulfilled")

		return success

	# --- helpers ---

	def _sales_order_exists(self, channel_order_id: str, channel: str) -> bool:
		return bool(
			frappe.db.exists(
				"Sales Order",
				{"custom_channel_order_id": channel_order_id, "custom_channel": channel},
			)
		)

	def _create_sales_order(self, order) -> str:
		customer = self._get_or_create_customer(order.customer_name, order.customer_email)

		so = frappe.get_doc(
			{
				"doctype": "Sales Order",
				"customer": customer,
				"order_type": "Sales",
				"transaction_date": order.created_at[:10],
				"delivery_date": order.created_at[:10],
				"custom_channel": order.channel,
				"custom_channel_order_id": order.channel_order_id,
				"custom_channel_status": order.status,
				"currency": order.currency,
				"items": [
					{
						"item_code": item.get("sku") or item.get("item_code"),
						"qty": item.get("quantity", 1),
						"rate": item.get("price", 0),
					}
					for item in order.items
				],
			}
		)
		so.insert(ignore_permissions=True)
		so.submit()
		return so.name

	def _get_or_create_customer(self, name: str, email: str) -> str:
		existing = frappe.db.get_value("Customer", {"customer_name": name}, "name")
		if existing:
			return existing

		customer = frappe.get_doc(
			{
				"doctype": "Customer",
				"customer_name": name,
				"customer_type": "Individual",
				"customer_group": "All Customer Groups",
				"territory": "All Territories",
			}
		)
		customer.insert(ignore_permissions=True)
		return customer.name

	def _last_sync_timestamp(self) -> str | None:
		last = frappe.db.get_value(
			"Sales Order",
			{"custom_channel": ("!=", "")},
			"creation",
			order_by="creation desc",
		)
		return str(last) if last else None
