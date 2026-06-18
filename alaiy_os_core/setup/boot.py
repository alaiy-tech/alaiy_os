import frappe

from alaiy_os_core.constants.workspace import WORKSPACE_NAME


def boot_session(bootinfo):
    """
    Runs on every page load.
    Strip all workspaces except the OS workspace from the sidebar so the
    ERPNext workspace list is not shown to any user.
    """
    if not hasattr(bootinfo, "sidebar_pages") or not bootinfo.sidebar_pages:
        return

    pages = bootinfo.sidebar_pages.get("pages", [])
    filtered = [
        p for p in pages
        if str(p.get("title", "")).strip() == WORKSPACE_NAME
        or str(p.get("label", "")).strip() == WORKSPACE_NAME
        or str(p.get("name",  "")).strip() == WORKSPACE_NAME
    ]
    if filtered:
        bootinfo.sidebar_pages["pages"] = filtered


def on_login(login_manager):
    """
    Redirect every user to the OS workspace on login.
    """
    frappe.local.response["redirect_to"] = f"/app/Workspaces/{WORKSPACE_NAME}"
