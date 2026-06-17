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
    """
    Runs immediately after a successful login.
    For AlaiyOS users: set the user's default landing so Frappe's own
    redirect logic sends them to the workspace.
    """
    user_roles = set(frappe.get_roles(login_manager.user))
    bypass = {"System Manager", "Administrator"}
    is_alaiy = bool(user_roles & ALAIY_OS_ROLES) and not bool(
        user_roles & bypass)

    if not is_alaiy:
        return

    # Frappe v16+ uses `default_workspace`; older versions used `home_page`.
    meta = frappe.get_meta("User")
    if meta.has_field("default_workspace"):
        frappe.db.set_value("User", login_manager.user,
                            "default_workspace", ALAIY_OS_WORKSPACE)
    elif meta.has_field("home_page"):
        frappe.db.set_value("User", login_manager.user,
                            "home_page", "/app/alaiy-os")


def on_login(login_manager):
    """
    Runs immediately after credentials are validated (before session creation).
    For AlaiyOS users: set the post-login redirect so Frappe sends them to
    /app/alaiy-os instead of / (which desk_access=0 would otherwise trigger).

    Belt-and-suspenders with on_session_creation and the default_workspace
    field — whichever fires last wins, but they all point to the same place.
    """
    user = login_manager.user
    user_roles = set(frappe.get_roles(user))
    bypass = {"System Manager", "Administrator"}
    is_alaiy = bool(user_roles & ALAIY_OS_ROLES) and not bool(
        user_roles & bypass)

    if not is_alaiy:
        return

    # Override the post-login redirect Frappe calculates from home_page / desk_access.
    login_manager.redirect_post_login = "/app/alaiy-os"
