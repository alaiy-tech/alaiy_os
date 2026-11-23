import frappe


def on_login(login_manager):
    frappe.local.response["redirect_to"] = "/desk/os"


def get_home_page(user):
    """Site root ("/") has no public-website meaning here — only the desk
    exists. Wired via the get_website_user_home_page hook, which is what
    Frappe's path resolver actually consults for "/" (a www/index.py
    controller is never reached — get_home_page() resolves the target path
    first and routes straight there)."""
    return "login" if user == "Guest" else "desk/os"
