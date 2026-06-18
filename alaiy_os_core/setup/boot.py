import frappe

from alaiy_os_core.constants.roles import ROLES
from alaiy_os_core.constants.workspace import WORKSPACE_NAME, WORKSPACE_ROUTE

ALAIY_OS_ROLES = set(ROLES)
ALAIY_OS_WORKSPACE = WORKSPACE_NAME
ALAIY_OS_ROUTE = WORKSPACE_ROUTE


def _is_alaiy_user():
    """True if the current user has an AlaiyOS role but is NOT a System Manager / Administrator."""
    user_roles = set(frappe.get_roles(frappe.session.user))
    bypass = {"System Manager", "Administrator"}
    return bool(user_roles & ALAIY_OS_ROLES) and not bool(user_roles & bypass)


def boot_session(bootinfo):
    """
    Runs on every page load.
    For AlaiyOS users: strip all workspaces except Alaiy OS from the sidebar
    data sent to the browser.

    NOTE: we do NOT set bootinfo.home_page here.  In Frappe v16 that field
    causes desk.js startup() to call frappe.set_route() before the workspace
    module is initialised, which hits frappe.desk.desk_page.getpage and
    returns 404.  The user's default_workspace field (set in
    on_session_creation / configure_login_redirect) is the correct v16
    mechanism for controlling the landing workspace.
    """
    if not _is_alaiy_user():
        return

    # Filter sidebar pages — defensive: only apply if the workspace is found.
    # An empty filter would leave the user with no sidebar, breaking the desk.
    if hasattr(bootinfo, "sidebar_pages") and bootinfo.sidebar_pages:
        pages = bootinfo.sidebar_pages.get("pages", [])
        filtered = [
            p for p in pages
            if str(p.get("title", "")).strip() == ALAIY_OS_WORKSPACE
            or str(p.get("label", "")).strip() == ALAIY_OS_WORKSPACE
            or str(p.get("name",  "")).strip() == ALAIY_OS_WORKSPACE
        ]
        if filtered:
            bootinfo.sidebar_pages["pages"] = filtered
        # If the workspace isn't found in sidebar_pages yet (first install
        # race condition), leave the sidebar untouched so the desk still boots.


def on_session_creation(login_manager):
    pass


def on_login(login_manager):
    """
    Runs immediately after credentials are validated (before session creation).
    Any user with an AlaiyOS role lands on the workspace. System Manager /
    Administrator bypass confinement via route_guard.js once they arrive.
    """
    user_roles = set(frappe.get_roles(login_manager.user))
    if not bool(user_roles & ALAIY_OS_ROLES):
        return

    frappe.local.response["redirect_to"] = "/app/Workspaces/OS"
