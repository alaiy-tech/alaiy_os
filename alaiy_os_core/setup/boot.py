import frappe

ALAIY_OS_ROLES = {"Alaiy OS Manager", "Alaiy OS User"}
ALAIY_OS_WORKSPACE = "Alaiy OS"
ALAIY_OS_ROUTE = "alaiy-os"


def _is_alaiy_user():
    """True if the current user has an AlaiyOS role but is NOT a System Manager / Administrator."""
    user_roles = set(frappe.get_roles(frappe.session.user))
    bypass = {"System Manager", "Administrator"}
    return bool(user_roles & ALAIY_OS_ROLES) and not bool(user_roles & bypass)


def boot_session(bootinfo):
    """
    Runs on every page load.
    For AlaiyOS users: strip all workspaces except Alaiy OS from the sidebar data
    sent to the browser, and force the home page to the workspace.
    """
    if not _is_alaiy_user():
        return

    # Filter sidebar pages
    if hasattr(bootinfo, "sidebar_pages") and bootinfo.sidebar_pages:
        pages = bootinfo.sidebar_pages.get("pages", [])
        bootinfo.sidebar_pages["pages"] = [
            p for p in pages
            if p.get("title") == ALAIY_OS_WORKSPACE
            or p.get("label") == ALAIY_OS_WORKSPACE
            or p.get("name") == ALAIY_OS_WORKSPACE
        ]

    bootinfo.home_page = ALAIY_OS_ROUTE


def on_session_creation(login_manager):
    """
    Runs immediately after a successful login.
    For AlaiyOS users: set the home_page DB field so Frappe's own
    redirect logic sends them to the workspace.
    """
    user_roles = set(frappe.get_roles(login_manager.user))
    bypass = {"System Manager", "Administrator"}
    is_alaiy = bool(user_roles & ALAIY_OS_ROLES) and not bool(
        user_roles & bypass)

    if not is_alaiy:
        return

    frappe.db.set_value("User", login_manager.user,
                        "home_page", "/app/alaiy-os")
