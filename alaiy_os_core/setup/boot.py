import frappe

from alaiy_os_core.constants.workspace import WORKSPACE_NAME


def boot_session(bootinfo):
    """
    Runs on every page load.
    Strip all workspaces except the OS workspace from the sidebar.
    Only applies when the OS workspace is actually present in the sidebar data
    — if it's missing (first install race) leave the sidebar untouched so the
    desk boots without a blank sidebar (which causes a redirect loop).
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
    # Only apply filter when the OS workspace is actually found.
    # An empty sidebar causes Frappe's desk JS to loop trying to find a workspace.
    if filtered:
        bootinfo.sidebar_pages["pages"] = filtered


def on_login(login_manager):
    """
    Redirect browser logins to the OS workspace.
    Skips API/token logins so background jobs and REST calls are unaffected.
    """
    # Only redirect interactive browser logins (Content-Type form or no body).
    # API calls use application/json and must not be redirected.
    content_type = frappe.request.content_type or ""
    if "application/json" in content_type:
        return

    frappe.local.response["redirect_to"] = f"/desk/Workspaces/{WORKSPACE_NAME}"
