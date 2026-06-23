import frappe

from alaiy_os_core.constants.workspace import WORKSPACE_NAME


def boot_session(bootinfo):
    # Strip all workspaces except the OS one from the sidebar.
    # Guard: only apply when the OS workspace exists — an empty sidebar triggers a Frappe redirect loop.
    if not hasattr(bootinfo, "sidebar_pages") or not bootinfo.sidebar_pages:
        return

    pages = bootinfo.sidebar_pages.get("pages", [])
    filtered = [
        p for p in pages
        if str(p.get("title", "")).strip() == WORKSPACE_NAME
        or str(p.get("label", "")).strip() == WORKSPACE_NAME
        or str(p.get("name",  "")).strip() == WORKSPACE_NAME
    ]
    # Only apply filter when the OS workspace is actually found.
    # An empty sidebar causes Frappe's desk JS to loop trying to find a workspace.
    if filtered:
        bootinfo.sidebar_pages["pages"] = filtered


def on_login(login_manager):
    frappe.local.response["redirect_to"] = "/desk/os"
