"""
Inventory API — read-only stock position endpoints for the frontend.

Call from frontend: frappe.call('alaiy_os_core.api.inventory.<method>', args)
"""

from __future__ import annotations

import frappe


@frappe.whitelist()
def get_stock(
    warehouse: str | None = None,
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
        fields=["item_code", "warehouse", "actual_qty", "reserved_qty", "projected_qty", "stock_uom"],
        order_by="item_code asc",
        limit=int(page_size),
        start=(int(page) - 1) * int(page_size),
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
def get_low_stock(threshold: int = 5) -> list[dict]:
    """Return items where actual_qty is below threshold."""
    return frappe.db.get_all(
        "Bin",
        filters={"actual_qty": ("<", threshold), "actual_qty": (">", 0)},
        fields=["item_code", "warehouse", "actual_qty", "projected_qty"],
        order_by="actual_qty asc",
        limit=100,
    )
