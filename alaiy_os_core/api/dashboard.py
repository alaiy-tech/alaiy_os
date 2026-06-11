"""
Dashboard KPI API — whitelisted methods consumed by the React frontend.

All methods return plain dicts (JSON-serialisable).
Call from the frontend: frappe.call('alaiy_os_core.api.dashboard.<method>')
"""

from __future__ import annotations

import frappe
from frappe import _


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
	open_returns = frappe.db.count("Return Request", {"status": ("in", ["Requested", "Approved"])})
	low_stock_items = frappe.db.count("Bin", {"actual_qty": ("<", 5), "actual_qty": (">", 0)})

	return {
		"total_orders": total_orders,
		"total_revenue": float(total_revenue),
		"open_returns": open_returns,
		"low_stock_items": low_stock_items,
		"date_range": date_range,
	}


@frappe.whitelist()
def get_channel_breakdown(date_range: str = "30d") -> list[dict]:
	"""
	Return order counts and revenue per channel for the given period.
	"""
	filters = _date_filters(date_range)

	rows = frappe.db.get_all(
		"Sales Order",
		filters=filters,
		fields=["custom_channel as channel", "count(*) as orders", "sum(grand_total) as revenue"],
		group_by="custom_channel",
		order_by="orders desc",
	)
	return rows


@frappe.whitelist()
def get_alerts() -> list[dict]:
	"""
	Return active Marketplace Alerts (stock-out, late ship, account health).
	"""
	alerts = frappe.get_all(
		"Marketplace Alert",
		filters={"resolved": 0},
		fields=["name", "alert_type", "channel", "item_code", "message", "severity", "creation"],
		order_by="severity desc, creation desc",
		limit=50,
	)
	return alerts


# --- helpers ---

def _date_filters(date_range: str) -> dict:
	from frappe.utils import add_days, today

	if date_range == "today":
		return {"transaction_date": today(), "docstatus": 1}
	if date_range == "7d":
		return {"transaction_date": (">=", add_days(today(), -7)), "docstatus": 1}
	if date_range == "30d":
		return {"transaction_date": (">=", add_days(today(), -30)), "docstatus": 1}
	return {"docstatus": 1}
