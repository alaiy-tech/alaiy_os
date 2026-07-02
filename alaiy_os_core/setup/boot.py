import frappe

from alaiy_os_core.constants.workspace import WORKSPACE_NAME
from alaiy_os_core.constants.workspace_settings import SETTINGS_WORKSPACE_NAME

_ALLOWED_WORKSPACES = {WORKSPACE_NAME, SETTINGS_WORKSPACE_NAME}


def boot_session(bootinfo):
    # Keep only the OS and OS Settings workspaces in the sidebar pages.
    # Guard: only apply when the OS workspace is found — an empty sidebar triggers a Frappe redirect loop.
    if not hasattr(bootinfo, "sidebar_pages") or not bootinfo.sidebar_pages:
        return

    pages = bootinfo.sidebar_pages.get("pages", [])
    filtered = [
        p for p in pages
        if str(p.get("title", "")).strip() in _ALLOWED_WORKSPACES
        or str(p.get("label", "")).strip() in _ALLOWED_WORKSPACES
        or str(p.get("name",  "")).strip() in _ALLOWED_WORKSPACES
    ]
    if filtered:
        bootinfo.sidebar_pages["pages"] = filtered


def on_login(login_manager):
    frappe.local.response["redirect_to"] = "/desk/os"
