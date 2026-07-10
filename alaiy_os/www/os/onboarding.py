import frappe

from alaiy_os.api.onboarding import is_onboarding_complete


def get_context(context):
    # Matches native Frappe's own setup wizard: log in as Administrator first
    # (credentials set during `bench new-site`), then land on the wizard.
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login?redirect-to=/os/onboarding"
        raise frappe.Redirect

    if is_onboarding_complete():
        frappe.local.flags.redirect_location = "/desk/os"
        raise frappe.Redirect

    context.no_cache = 1
    return context
