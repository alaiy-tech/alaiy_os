"""
Dashboard KPI API — whitelisted methods consumed by the React frontend.

Call from frontend: frappe.call('alaiy_os_core.api.dashboard.<method>')
"""

from __future__ import annotations

import frappe


@frappe.whitelist()
def get_kpis(date_range: str = "today") -> dict:
    """
    Return top-level KPIs for the dashboard header strip.
    date_range: "today" | "7d" | "30d"
    """
    filters = _date_filters(date_range)

    total_orders = frappe.db.count("Sales Order", filters)
    total_revenue = (
        frappe.db.get_value(
            "Sales Order",
            filters,
            "sum(grand_total)",
            as_dict=False,
        )
        or 0
    )
    low_stock_items = frappe.db.count("Bin", {"actual_qty": ("<", 5), "actual_qty": (">", 0)})

    return {
        "total_orders": total_orders,
        "total_revenue": float(total_revenue),
        "low_stock_items": low_stock_items,
        "date_range": date_range,
    }


def _date_filters(date_range: str) -> dict:
    from frappe.utils import add_days, today

    if date_range == "today":
        return {"transaction_date": today(), "docstatus": 1}
    if date_range == "7d":
        return {"transaction_date": (">=", add_days(today(), -7)), "docstatus": 1}
    if date_range == "30d":
        return {"transaction_date": (">=", add_days(today(), -30)), "docstatus": 1}
    return {"docstatus": 1}
