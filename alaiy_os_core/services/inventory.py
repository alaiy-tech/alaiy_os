"""
InventoryService — reads stock from ERPNext Bin and pushes levels to channels.

Writes always go through Stock Entry / Stock Reconciliation — never direct Bin writes.
"""

from __future__ import annotations

import frappe

from alaiy_os_core.connectors.registry import ConnectorRegistry


class InventoryService:

	def get_stock_positions(self, item_codes: list[str] | None = None, warehouse: str | None = None) -> list[dict]:
		"""
		Return current stock positions from ERPNext Bin.
		Optionally filter by item codes or warehouse.
		"""
		filters: dict = {}
		if item_codes:
			filters["item_code"] = ("in", item_codes)
		if warehouse:
			filters["warehouse"] = warehouse

		bins = frappe.get_all(
			"Bin",
			filters=filters,
			fields=["item_code", "warehouse", "actual_qty", "reserved_qty", "projected_qty"],
		)
		return bins

	def push_inventory_to_channel(self, channel: str | None = None, warehouse: str | None = None) -> dict:
		"""
		Read current stock from ERPNext and push it to the channel connector.
		Returns a summary of items pushed.
		"""
		settings = frappe.get_single("Alaiy OS Settings")
		warehouse = warehouse or frappe.db.get_single_value("Stock Settings", "default_warehouse")

		bins = self.get_stock_positions(warehouse=warehouse)
		sku_map: dict[str, int] = {}

		for b in bins:
			channel_listing = frappe.db.get_value(
				"Channel Listing",
				{"item_code": b["item_code"], "channel": channel or settings.primary_channel},
				"channel_sku",
			)
			if channel_listing:
				sku_map[channel_listing] = max(0, int(b["actual_qty"] - b["reserved_qty"]))

		if not sku_map:
			return {"pushed": 0, "message": "No channel listings found for this warehouse"}

		connector = ConnectorRegistry.get_channel(channel)
		success = connector.update_inventory(sku_map)
		return {"pushed": len(sku_map), "success": success}

	def reconcile_from_oms(self) -> dict:
		"""
		Pull inventory from the external OMS (Globali use-case) and create a
		Stock Reconciliation in ERPNext to align Bin quantities.
		"""
		connector = ConnectorRegistry.get_oms()
		oms_entries = connector.pull_inventory()

		items = []
		for entry in oms_entries:
			items.append(
				{
					"item_code": entry.item_code,
					"warehouse": entry.warehouse,
					"qty": entry.qty,
				}
			)

		if not items:
			return {"reconciled": 0}

		recon = frappe.get_doc(
			{
				"doctype": "Stock Reconciliation",
				"purpose": "Stock Reconciliation",
				"items": items,
			}
		)
		recon.insert(ignore_permissions=True)
		recon.submit()
		return {"reconciled": len(items), "doc": recon.name}
