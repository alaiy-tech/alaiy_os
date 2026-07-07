import frappe


def on_login(login_manager):
    frappe.local.response["redirect_to"] = "/desk/os"
