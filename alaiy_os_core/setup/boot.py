import frappe


def boot_session(bootinfo):
    # Keep only the AlaiyOS workspace sidebars (app="alaiy_os_core") in the
    # sidebar pages so ERPNext's own workspaces are not visible to OS users.
    # Guard: only apply when at least one alaiy sidebar is found — an empty
    # sidebar list causes Frappe's desk JS to loop trying to find a workspace.
    if not hasattr(bootinfo, "sidebar_pages") or not bootinfo.sidebar_pages:
        return

    # Resolve sidebar names dynamically so we don't hardcode company-prefixed names
    # (Frappe's Workspace Sidebar uses autoname=field:title, so name == title).
    try:
        alaiy_names = set(frappe.db.get_all(
            "Workspace Sidebar",
            filters={"app": "alaiy_os_core"},
            pluck="name",
        ))
    except Exception:
        return

    if not alaiy_names:
        return

    pages = bootinfo.sidebar_pages.get("pages", [])
    filtered = [
        p for p in pages
        if str(p.get("name",  "")).strip() in alaiy_names
        or str(p.get("title", "")).strip() in alaiy_names
    ]
    if filtered:
        bootinfo.sidebar_pages["pages"] = filtered


def on_login(login_manager):
    frappe.local.response["redirect_to"] = "/desk/os"
