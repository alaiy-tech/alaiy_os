import frappe


def after_install():
	hide_non_stock_workspaces()
	frappe.db.commit()
	frappe.clear_cache()


def hide_non_stock_workspaces():
	"""
	Hide every workspace except Stock.
	Fetches all workspaces at install time so future ERPNext
	updates that add new workspaces are covered automatically.
	"""
	all_workspaces = frappe.get_all("Workspace", fields=["name"])

	for ws in all_workspaces:
		if ws["name"] == "Stock":
			continue
		frappe.db.set_value("Workspace", ws["name"], "is_hidden", 1)
