"""
Inventory API — whitelisted methods for the Inventory screen.

Call from frontend: frappe.call('alaiy_os_core.api.inventory.<method>', args)
"""

from __future__ import annotations

import frappe
from frappe import _


@frappe.whitelist()
def get_stock(
	warehouse: str | None = None,
	item_group: str | None = None,
	search: str | None = None,
	page: int = 1,
	page_size: int = 50,
) -> dict:
	"""Return current stock positions from ERPNext Bin."""
	filters: dict = {}
	if warehouse:
		filters["warehouse"] = warehouse

	bins = frappe.get_all(
		"Bin",
		filters=filters,
		fields=[
			"item_code",
			"warehouse",
			"actual_qty",
			"reserved_qty",
			"projected_qty",
			"stock_uom",
		],
		order_by="item_code asc",
		limit=page_size,
		start=(page - 1) * page_size,
	)

	total = frappe.db.count("Bin", filters)
	return {"items": bins, "total": total, "page": page, "page_size": page_size}


@frappe.whitelist()
def get_item_stock(item_code: str) -> list[dict]:
	"""Return stock across all warehouses for a specific item."""
	return frappe.get_all(
		"Bin",
		filters={"item_code": item_code},
		fields=["warehouse", "actual_qty", "reserved_qty", "projected_qty", "stock_uom"],
	)


@frappe.whitelist()
def push_inventory_to_channel(channel: str | None = None, warehouse: str | None = None) -> dict:
	"""Push current stock levels from ERPNext to the channel connector."""
	from alaiy_os_core.services.inventory import InventoryService

	frappe.enqueue(
		method=InventoryService().push_inventory_to_channel,
		queue="default",
		channel=channel,
		warehouse=warehouse,
		job_name=f"push_inventory_{channel or 'default'}",
	)
	return {"message": _("Inventory push queued")}


@frappe.whitelist()
def get_low_stock_alerts(threshold: int = 5) -> list[dict]:
	"""Return items where actual_qty is below threshold."""
	return frappe.db.get_all(
		"Bin",
		filters={"actual_qty": ("<", threshold), "actual_qty": (">", 0)},
		fields=["item_code", "warehouse", "actual_qty", "projected_qty"],
		order_by="actual_qty asc",
		limit=100,
	)
