"""
AlaiyOS Core — provisioning logic.

This module is the single source of truth for the AlaiyOS environment. It runs
on `after_install` (fresh install) and `after_migrate` (every deploy), and
reconciles the live ERPNext site to match the definitions in this file.

Data definitions live in alaiy_os_core/constants/:
  * roles.py        — ROLES
  * workspace.py    — WORKSPACE_NAME, shortcuts, links, STANDARD_WORKSPACES_TO_HIDE
  * permissions.py  — TARGET_DOCTYPES, DESK_INFRA_DOCTYPES, permission maps
  * branding.py     — logo / favicon asset paths

The app code is authoritative — manual edits made in the ERPNext UI to the
Alaiy OS workspace links/shortcuts or to the reconciled permissions are
overwritten on the next `bench migrate`.
"""

import hashlib
import json

import frappe
import frappe.utils.password

from alaiy_os_core.client.config import boot_config
from alaiy_os_core.constants import branding
from alaiy_os_core.constants.roles import ROLES
from alaiy_os_core.constants.workspace import (
    WORKSPACE_NAME,
    WORKSPACE_SHORTCUTS,
    WORKSPACE_LINKS,
    WORKSPACE_SIDEBAR_ITEMS,
    STANDARD_WORKSPACES_TO_HIDE,
)
from alaiy_os_core.constants.permissions import (
    PERMISSION_MAP,
    READ_ONLY_MAP,
    TARGET_DOCTYPES,
    DESK_INFRA_DOCTYPES,
)

LOGO_URL = branding.LOGO_SQUARE


# ── Config loading (MUST FAIL LOUDLY) ─────────────────────────────────────────

def _load_config():
    required = ["ALAIY_OS_ADMIN_USERNAME",
                "ALAIY_OS_ADMIN_EMAIL", "ALAIY_OS_ADMIN_PASSWORD"]
    missing = [k for k in required if not getattr(boot_config, k, None)]
    if missing:
        raise frappe.ValidationError(
            f"[AlaiyOS] Installation aborted. Missing required fields in "
            f"boot_config.py: {missing}. "
            f"Please configure alaiy_os_core/client/config/boot_config.py before installing."
        )
    return {k: getattr(boot_config, k) for k in required}


# ── Entry points ──────────────────────────────────────────────────────────────

def after_install():
    _run_provisioning()


def after_migrate():
    _run_provisioning()


def _run_provisioning():
    config = _load_config()
    create_roles()
    create_or_update_user(config)
    create_or_update_workspace()
    create_or_update_workspace_sidebar()
    reconcile_doctype_permissions()
    restrict_standard_workspaces()
    configure_login_redirect(config)
    configure_branding()
    frappe.db.commit()
    frappe.clear_cache()


# ── Roles ─────────────────────────────────────────────────────────────────────

def create_roles():
    """
    Create both AlaiyOS roles with desk access.

    IMPORTANT — desk_access MUST be 1.
    These users live entirely inside the /app desk (the Alaiy OS workspace).
    Setting desk_access=0 makes Frappe v16 treat them as Website Users and
    blocks every /app/* route, so home_page=/app/alaiy-os bounces to "/" and
    back — an infinite login redirect loop. The /desk legacy route is blocked
    instead by route_guard.js + boot redirects, not by removing desk access.
    """
    for role_name in ROLES:
        if not frappe.db.exists("Role", role_name):
            frappe.get_doc({
                "doctype": "Role",
                "role_name": role_name,
                "desk_access": 1,
            }).insert(ignore_permissions=True)
        else:
            # Re-enforce on migrate in case it was flipped in the UI.
            frappe.db.set_value("Role", role_name, "desk_access", 1)


# ── User ──────────────────────────────────────────────────────────────────────

def create_or_update_user(config):
    email = config["ALAIY_OS_ADMIN_EMAIL"]
    username = config["ALAIY_OS_ADMIN_USERNAME"]
    password = config["ALAIY_OS_ADMIN_PASSWORD"]

    if not frappe.db.exists("User", email):
        user = frappe.get_doc({
            "doctype": "User",
            "email": email,
            "username": username,
            "first_name": "AlaiyOS",
            "last_name": "Admin",
            "send_welcome_email": 0,
            "user_type": "System User",
            "roles": [{"role": r} for r in ROLES]
        })
        user.insert(ignore_permissions=True)
        frappe.utils.password.update_password(email, password)
    else:
        user = frappe.get_doc("User", email)
        existing_roles = {r.role for r in user.roles}
        changed = False
        for role_name in ROLES:
            if role_name not in existing_roles:
                user.append("roles", {"role": role_name})
                changed = True
        if changed:
            user.save(ignore_permissions=True)


# ── Workspace ───────────────────────────────────────────────────────────────

def _block_id(label):
    """Deterministic 10-char block ID — stable across migrate runs."""
    return hashlib.md5(f"alaiy-block-{label}".encode()).hexdigest()[:10]


def _build_workspace_content():
    """
    Generate the Frappe v16 workspace content JSON string.

    In Frappe v16, the workspace canvas is driven by the `content` field —
    a JSON-encoded array of block editor nodes. `links` and `shortcuts` store
    the DATA; `content` stores the LAYOUT referencing them by name.
    Empty `'[]'` renders a blank workspace even with populated links/shortcuts.

    Block types:
      shortcut — data.shortcut_name must match a label in the shortcuts table
      card     — data.card_name must match a Card Break label in the links table
    """
    blocks = []

    # Shortcut row — col:3 → 4 shortcuts per row (12-col grid)
    for s in WORKSPACE_SHORTCUTS:
        blocks.append({
            "id":   _block_id(f"sc:{s['label']}"),
            "type": "shortcut",
            "data": {"shortcut_name": s["label"], "col": 3},
        })

    # Card grid — col:4 → 3 cards per row
    for link in WORKSPACE_LINKS:
        if link.get("type") == "Card Break":
            blocks.append({
                "id":   _block_id(f"card:{link['label']}"),
                "type": "card",
                "data": {"card_name": link["label"], "col": 4},
            })

    return json.dumps(blocks)


def create_or_update_workspace():
    content = _build_workspace_content()

    if not frappe.db.exists("Workspace", WORKSPACE_NAME):
        ws = frappe.get_doc({
            "doctype": "Workspace",
            "label": WORKSPACE_NAME,
            "title": WORKSPACE_NAME,
            "name": WORKSPACE_NAME,
            "type": "Workspace",   # required in Frappe v16
            "public": 1,
            "icon": LOGO_URL,
            "content": content,    # drives the v16 workspace canvas
            "roles": [{"role": r} for r in ROLES],
            "shortcuts": WORKSPACE_SHORTCUTS,
            "links": WORKSPACE_LINKS,
        })
        ws.insert(ignore_permissions=True)
    else:
        ws = frappe.get_doc("Workspace", WORKSPACE_NAME)

        # Always overwrite links, shortcuts and content — app code is source of truth
        ws.set("links", [])
        ws.set("shortcuts", [])
        for link in WORKSPACE_LINKS:
            ws.append("links", link)
        for shortcut in WORKSPACE_SHORTCUTS:
            ws.append("shortcuts", shortcut)

        ws.icon = LOGO_URL
        ws.content = content      # regenerate from code every run
        ws.type = "Workspace"     # ensure the v16 type field is set

        # Ensure roles are present
        existing_roles = {r.role for r in ws.roles}
        for role_name in ROLES:
            if role_name not in existing_roles:
                ws.append("roles", {"role": role_name})

        ws.save(ignore_permissions=True)


# ── Workspace Sidebar ────────────────────────────────────────────────────────

def create_or_update_workspace_sidebar():
    """
    Provision the global left-panel sidebar for the Alaiy OS workspace.

    Frappe renders the sidebar when a `Workspace Sidebar` record exists with:
      name     == workspace name ("Alaiy OS")
      for_user == ""  (empty = visible to all users on this workspace)

    A user-specific record (for_user set) is only visible to that one user,
    which is why the AlaiyOS user sees no sidebar if the record was created
    by the admin through the UI (it gets pinned to the admin's email).

    We always overwrite items so the app code stays the source of truth.
    """
    if frappe.db.exists("Workspace Sidebar", WORKSPACE_NAME):
        sidebar = frappe.get_doc("Workspace Sidebar", WORKSPACE_NAME)
        sidebar.for_user = ""       # ensure global scope
        sidebar.set("items", [])
        for item in WORKSPACE_SIDEBAR_ITEMS:
            sidebar.append("items", item)
        sidebar.save(ignore_permissions=True)
    else:
        sidebar = frappe.get_doc({
            "doctype": "Workspace Sidebar",
            "name":    WORKSPACE_NAME,
            "title":   WORKSPACE_NAME,
            "for_user": "",
            "standard": 0,
            "app":     "alaiy_os_core",
            "items":   WORKSPACE_SIDEBAR_ITEMS,
        })
        sidebar.insert(ignore_permissions=True)


# ── DocType permissions — full reconciliation ─────────────────────────────────

def reconcile_doctype_permissions():
    _infra_set = set(DESK_INFRA_DOCTYPES)
    _all_desired = set(TARGET_DOCTYPES) | _infra_set

    for role in ROLES:
        existing_records = frappe.get_all(
            "Custom DocPerm",
            filters={"role": role},
            fields=["name", "parent"]
        )
        existing_doctypes = {r.parent for r in existing_records}

        # Add permissions for DocTypes not yet covered
        for dt in _all_desired - existing_doctypes:
            if frappe.db.exists("DocType", dt):
                pmap = READ_ONLY_MAP if dt in _infra_set else PERMISSION_MAP
                frappe.get_doc({
                    "doctype": "Custom DocPerm",
                    "parent": dt,
                    "parenttype": "DocType",
                    "parentfield": "permissions",
                    "role": role,
                    **pmap
                }).insert(ignore_permissions=True)

        # Remove permissions for DocTypes no longer in either list
        for dt in existing_doctypes - _all_desired:
            stale = frappe.get_all(
                "Custom DocPerm",
                filters={"parent": dt, "role": role},
                fields=["name"]
            )
            for record in stale:
                frappe.delete_doc(
                    "Custom DocPerm", record.name,
                    ignore_permissions=True, force=True
                )


# ── Restrict standard workspaces ──────────────────────────────────────────────
# List imported from constants/workspace.py — edit it there.

def restrict_standard_workspaces():
    for ws_name in STANDARD_WORKSPACES_TO_HIDE:
        if not frappe.db.exists("Workspace", ws_name):
            continue
        ws = frappe.get_doc("Workspace", ws_name)
        original_count = len(ws.roles)
        ws.roles = [r for r in ws.roles if r.role not in set(ROLES)]
        if len(ws.roles) != original_count:
            ws.save(ignore_permissions=True)


# ── Branding ──────────────────────────────────────────────────────────────

def configure_branding():
    """
    Set Frappe Settings singletons to use AlaiyOS brand assets.
    Idempotent — safe to run on every migrate.
    """
    def _safe_set(doctype, field, value):
        try:
            meta = frappe.get_meta(doctype)
            if meta.has_field(field):
                frappe.db.set_single_value(doctype, field, value)
        except Exception:
            frappe.log_error(
                title="AlaiyOS: configure_branding failed",
                message=frappe.get_traceback(),
            )

    # Desk navbar top-left logo
    _safe_set("Navbar Settings",  "app_logo",     branding.LOGO_HOR)
    # Login page / website branding
    _safe_set("Website Settings", "app_logo",     branding.LOGO_SQUARE)
    _safe_set("Website Settings", "banner_image", branding.LOGO_HOR)
    _safe_set("Website Settings", "brand_html",
              f'<img src="{branding.LOGO_HOR}" alt="{branding.APP_NAME}" style="height:32px">')
    _safe_set("Website Settings", "splash_image", branding.LOGO_SQUARE)
    # Favicon (read from both singletons depending on Frappe version)
    _safe_set("System Settings",  "favicon",      branding.FAVICON)
    _safe_set("Website Settings", "favicon",      branding.FAVICON)
    # App name
    _safe_set("System Settings",  "app_name",     branding.APP_NAME)
    _safe_set("Website Settings", "app_name",     branding.APP_NAME)


# ── Login redirect ─────────────────────────────────────────────────────────

def configure_login_redirect(config):
    email = config["ALAIY_OS_ADMIN_EMAIL"]
    if frappe.db.exists("User", email):
        set_user_landing(email)


def set_user_landing(user):
    """
    Point a user at the Alaiy OS workspace on login.

    Frappe renamed/removed the User landing field across versions:
      * v16+ uses `default_workspace` (Link to Workspace -> stores "Alaiy OS").
      * older versions used `home_page` (stores a route like "/app/alaiy-os").
    Set whichever field exists so this never crashes migrate.
    """
    meta = frappe.get_meta("User")
    if meta.has_field("default_workspace"):
        frappe.db.set_value("User", user, "default_workspace", WORKSPACE_NAME)
    elif meta.has_field("home_page"):
        frappe.db.set_value("User", user, "home_page", "/app/alaiy-os")
