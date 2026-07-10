import frappe

from alaiy_os.api.onboarding import is_onboarding_complete


def on_login(login_manager):
    if is_onboarding_complete():
        frappe.local.response["redirect_to"] = "/desk/os"
    else:
        frappe.local.response["redirect_to"] = "/os/onboarding"
