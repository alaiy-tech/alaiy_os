import frappe

from alaiy_os.api.onboarding import is_onboarding_complete


def get_context(context):
    # No login required — this page is reachable as Guest on purpose. There's
    # no account to log into yet on a fresh install; Step 2 of the wizard
    # itself is what creates the first user, and complete_onboarding() logs
    # that session in at the end. Once onboarding has actually run, this page
    # is retired for good (both for Guest and any already-logged-in user).
    if is_onboarding_complete():
        frappe.local.flags.redirect_location = "/desk/os"
        raise frappe.Redirect

    context.no_cache = 1
    return context
