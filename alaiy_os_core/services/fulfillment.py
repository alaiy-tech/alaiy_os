"""
FulfillmentService — orchestrates pick → ship → update channel for outbound orders.
"""

from __future__ import annotations

import frappe

from alaiy_os_core.connectors.registry import ConnectorRegistry


class FulfillmentService:

	def fulfill(self, sales_order_id: str) -> dict:
		"""
		Full fulfillment flow for a Sales Order:
		  1. Create Delivery Note in ERPNext.
		  2. Book shipment via logistics connector.
		  3. Push fulfillment + tracking back to the channel.
		  4. Update Delivery Note with tracking number.
		"""
		so = frappe.get_doc("Sales Order", sales_order_id)
		channel = so.get("custom_channel")
		channel_order_id = so.get("custom_channel_order_id")

		if not channel_order_id:
			frappe.throw(f"Sales Order {sales_order_id} is not linked to a channel order")

		# Step 1 — create Delivery Note
		dn = self._create_delivery_note(so)

		# Step 2 — book shipment
		logistics = ConnectorRegistry.get_logistics()
		shipment = logistics.create_shipment(
			sales_order_id=sales_order_id,
			origin=self._get_warehouse_address(so),
			destination=self._get_shipping_address(so),
			parcels=[{"weight": 0.5}],  # TODO: derive from item weights
		)

		# Step 3 — push tracking to channel
		channel_connector = ConnectorRegistry.get_channel(channel)
		channel_connector.fulfill_order(channel_order_id, shipment.tracking_number, shipment.carrier)

		# Step 4 — update Delivery Note
		dn.db_set("custom_tracking_number", shipment.tracking_number)
		dn.db_set("custom_carrier", shipment.carrier)

		return {
			"delivery_note": dn.name,
			"tracking_number": shipment.tracking_number,
			"carrier": shipment.carrier,
			"label_url": shipment.label_url,
		}

	def _create_delivery_note(self, so):
		from frappe.model.mapper import get_mapped_doc

		dn = get_mapped_doc(
			"Sales Order",
			so.name,
			{
				"Sales Order": {"doctype": "Delivery Note"},
				"Sales Order Item": {"doctype": "Delivery Note Item"},
			},
		)
		dn.insert(ignore_permissions=True)
		dn.submit()
		return dn

	def _get_warehouse_address(self, so) -> dict:
		# TODO: derive from company address / warehouse address
		return {}

	def _get_shipping_address(self, so) -> dict:
		# TODO: derive from Sales Order shipping address
		return {}
