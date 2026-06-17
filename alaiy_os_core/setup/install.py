"""
AlaiyOS Core — provisioning logic.

This module is the single source of truth for the AlaiyOS environment. It runs
on `after_install` (fresh install) and `after_migrate` (every deploy), and
reconciles the live ERPNext site to match the definitions in this file.

Data definitions live in alaiy_os_core/constants/:
  * roles.py        — ROLES
  * workspace.py    — WORKSPACE_NAME, shortcuts, links, sidebar items
  * permissions.py  — TARGET_DOCTYPES, DESK_INFRA_DOCTYPES, permission maps
  * branding.py     — logo / favicon asset paths
  * onboarding.py   — ONBOARDING_NAME, ONBOARDING_STEPS

Configurable settings live in alaiy_os_core/client/config/boot_config.py:
  * ALAIY_OS_ADMIN_USERNAME / EMAIL / PASSWORD
  * ENABLE_ONBOARDING

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
from alaiy_os_core.constants.onboarding import ONBOARDING_NAME, ONBOARDING_STEPS

LOGO_URL      = branding.LOGO_SQUARE
MODULE_NAME   = "Alaiy OS"


# ── Company defaults ──────────────────────────────────────────────────────────

def set_company_defaults():
    """
    Sync COMPANY_NAME from boot_config into ERPNext Global Defaults.

    Runs FIRST in _run_provisioning() because the workspace title and
    module are derived from Global Defaults.default_company.

    On every migrate:
      - If the company does not exist → create it (using COMPANY_CURRENCY /
        COMPANY_COUNTRY from boot_config, falling back to USD / India).
      - Always re-set it as the default company so renames or resets are
        corrected automatically.
    """
    company_name = getattr(boot_config, "COMPANY_NAME", "").strip()
    if not company_name:
        return

    if not frappe.db.exists("Company", company_name):
        try:
            abbr = "".join(w[0].upper() for w in company_name.split()[:3]) or company_name[:3].upper()
            frappe.get_doc({
                "doctype":          "Company",
                "company_name":     company_name,
                "abbr":             abbr,
                "default_currency": getattr(boot_config, "COMPANY_CURRENCY", "USD"),
                "country":          getattr(boot_config, "COMPANY_COUNTRY", "India"),
            }).insert(ignore_permissions=True)
        except Exception:
            frappe.log_error(
                title="AlaiyOS: could not create Company",
                message=frappe.get_traceback(),
            )

    frappe.db.set_single_value("Global Defaults", "default_company", company_name)


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


def _cleanup_legacy_workspace():
    """
    Delete old workspace/sidebar records whose names changed between deploys.

    Called at the TOP of _run_provisioning() so create_or_update_* always
    works on a clean slate.  Extend OLD_NAMES when WORKSPACE_NAME is ever
    changed again.
    """
    OLD_NAMES = ["Alaiy OS"]
    for old in OLD_NAMES:
        if frappe.db.exists("Workspace Sidebar", old):
            frappe.delete_doc("Workspace Sidebar", old,
                              ignore_permissions=True, force=True)
        if frappe.db.exists("Workspace", old):
            frappe.delete_doc("Workspace", old,
                              ignore_permissions=True, force=True)


def _run_provisioning():
    config = _load_config()
    set_company_defaults()      # must be first — workspace title derives from company name
    _cleanup_legacy_workspace()  # delete stale records before re-creating
    create_module_def()
    create_roles()
    create_or_update_user(config)
    create_or_update_workspace()
    create_or_update_workspace_sidebar()
    create_or_update_onboarding()
    reconcile_doctype_permissions()
    restrict_standard_workspaces()
    configure_login_redirect(config)
    configure_branding()
    frappe.db.commit()
    frappe.clear_cache()


# ── Module Def ────────────────────────────────────────────────────────────────

def create_module_def():
    """Create (or re-assert) the custom 'Alaiy OS' module definition."""
    if not frappe.db.exists("Module Def", MODULE_NAME):
        frappe.get_doc({
            "doctype":     "Module Def",
            "module_name": MODULE_NAME,
            "app_name":    "alaiy_os_core",
            "custom":      1,
        }).insert(ignore_permissions=True)
    else:
        frappe.db.set_value("Module Def", MODULE_NAME, {
            "app_name": "alaiy_os_core",
            "custom":   1,
        })


# ── Roles ─────────────────────────────────────────────────────────────────────

def create_roles():
    """
    Create both AlaiyOS roles with desk access and mark them as custom.

    IMPORTANT — desk_access MUST be 1.
    These users live entirely inside the /app desk (the Alaiy OS workspace).
    Setting desk_access=0 makes Frappe v16 treat them as Website Users and
    blocks every /app/* route, so home_page=/app/alaiy-os bounces to "/" and
    back — an infinite login redirect loop.
    """
    for role_name in ROLES:
        if not frappe.db.exists("Role", role_name):
            frappe.get_doc({
                "doctype":    "Role",
                "role_name":  role_name,
                "desk_access": 1,
            }).insert(ignore_permissions=True)

        # Re-enforce on every migrate
        updates = {"desk_access": 1}
        meta = frappe.get_meta("Role")
        if meta.has_field("is_custom"):
            updates["is_custom"] = 1
        frappe.db.set_value("Role", role_name, updates)


# ── User ──────────────────────────────────────────────────────────────────────

def create_or_update_user(config):
    email    = config["ALAIY_OS_ADMIN_EMAIL"]
    username = config["ALAIY_OS_ADMIN_USERNAME"]
    password = config["ALAIY_OS_ADMIN_PASSWORD"]

    if not frappe.db.exists("User", email):
        user = frappe.get_doc({
            "doctype":          "User",
            "email":            email,
            "username":         username,
            "first_name":       "AlaiyOS",
            "last_name":        "Admin",
            "send_welcome_email": 0,
            "user_type":        "System User",
            "roles":            [{"role": r} for r in ROLES],
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

    # Always ensure the default workspace is set for this user
    set_user_landing(email)


# ── Workspace ─────────────────────────────────────────────────────────────────

def _block_id(label):
    """Deterministic 10-char block ID — stable across migrate runs."""
    return hashlib.md5(f"alaiy-block-{label}".encode()).hexdigest()[:10]


def _build_workspace_content():
    """
    Generate the Frappe v16 workspace content JSON string.

    In Frappe v16 the workspace canvas is driven by the `content` field —
    a JSON-encoded array of block editor nodes. `links` and `shortcuts` store
    the DATA; `content` stores the LAYOUT referencing them by name.
    """
    blocks = []

    for s in WORKSPACE_SHORTCUTS:
        blocks.append({
            "id":   _block_id(f"sc:{s['label']}"),
            "type": "shortcut",
            "data": {"shortcut_name": s["label"], "col": 3},
        })

    for link in WORKSPACE_LINKS:
        if link.get("type") == "Card Break":
            blocks.append({
                "id":   _block_id(f"card:{link['label']}"),
                "type": "card",
                "data": {"card_name": link["label"], "col": 4},
            })

    return json.dumps(blocks)


def _get_workspace_title():
    """
    Return the workspace display title as '<Company> OS'.
    Falls back to 'Alaiy OS' if no default company is configured.
    """
    default_company = frappe.db.get_single_value("Global Defaults", "default_company") or ""
    return (default_company + " OS") if default_company else WORKSPACE_NAME


def create_or_update_workspace():
    content = _build_workspace_content()
    title   = _get_workspace_title()

    if not frappe.db.exists("Workspace", WORKSPACE_NAME):
        ws = frappe.get_doc({
            "doctype":  "Workspace",
            "label":    WORKSPACE_NAME,
            "title":    title,
            "name":     WORKSPACE_NAME,
            "type":     "Workspace",
            "public":   1,
            "icon":     "layout-dashboard",
            "module":   MODULE_NAME,
            "app":      "alaiy_os_core",
            "content":  content,
            "roles":    [{"role": r} for r in ROLES],
            "shortcuts": WORKSPACE_SHORTCUTS,
            "links":    WORKSPACE_LINKS,
        })
        ws.insert(ignore_permissions=True)
    else:
        ws = frappe.get_doc("Workspace", WORKSPACE_NAME)

        ws.set("links", [])
        ws.set("shortcuts", [])
        for link in WORKSPACE_LINKS:
            ws.append("links", link)
        for shortcut in WORKSPACE_SHORTCUTS:
            ws.append("shortcuts", shortcut)

        ws.title   = title
        ws.icon    = "layout-dashboard"
        ws.module  = MODULE_NAME
        ws.app     = "alaiy_os_core"
        ws.type    = "Workspace"
        ws.public  = 1
        ws.content = content

        existing_roles = {r.role for r in ws.roles}
        for role_name in ROLES:
            if role_name not in existing_roles:
                ws.append("roles", {"role": role_name})

        ws.save(ignore_permissions=True)


# ── Workspace Sidebar ─────────────────────────────────────────────────────────

def create_or_update_workspace_sidebar():
    """
    Provision the global left-panel sidebar for the Alaiy OS workspace.

    Frappe renders the sidebar when a `Workspace Sidebar` record exists with:
      name     == workspace name ("Alaiy OS")
      for_user == ""  (empty = visible to all users on this workspace)

    We always overwrite items so app code stays the source of truth.
    The module_onboarding field is managed by create_or_update_onboarding().
    """
    if frappe.db.exists("Workspace Sidebar", WORKSPACE_NAME):
        sidebar = frappe.get_doc("Workspace Sidebar", WORKSPACE_NAME)
        sidebar.for_user = ""
        sidebar.set("items", [])
        for item in WORKSPACE_SIDEBAR_ITEMS:
            sidebar.append("items", item)
        sidebar.save(ignore_permissions=True)
    else:
        sidebar = frappe.get_doc({
            "doctype":  "Workspace Sidebar",
            "name":     WORKSPACE_NAME,
            "title":    WORKSPACE_NAME,
            "for_user": "",
            "standard": 0,
            "app":      "alaiy_os_core",
            "items":    WORKSPACE_SIDEBAR_ITEMS,
        })
        sidebar.insert(ignore_permissions=True)


# ── Module Onboarding ─────────────────────────────────────────────────────────

def create_or_update_onboarding():
    """
    Create or update the Alaiy OS Onboarding Module Onboarding doc.

    When ENABLE_ONBOARDING = True in boot_config.py:
      - creates/updates the Module Onboarding record with ONBOARDING_STEPS
      - links the sidebar's module_onboarding field to it

    When ENABLE_ONBOARDING = False (default):
      - clears the sidebar's module_onboarding field (hides Getting Started)
    """
    enable = getattr(boot_config, "ENABLE_ONBOARDING", False)

    if not enable:
        # Detach onboarding from sidebar so Getting Started is hidden
        if frappe.db.exists("Workspace Sidebar", WORKSPACE_NAME):
            frappe.db.set_value("Workspace Sidebar", WORKSPACE_NAME,
                                "module_onboarding", None)
        return

    # Build / refresh the Module Onboarding document
    if not frappe.db.exists("Module Onboarding", ONBOARDING_NAME):
        doc = frappe.get_doc({
            "doctype":          "Module Onboarding",
            "name":             ONBOARDING_NAME,
            "title":            ONBOARDING_NAME,
            "subtitle":         "Get your workspace ready in a few steps.",
            "success_message":  "Great — your workspace is all set!",
            "documentation_url": "",
            "is_complete":      0,
            "steps":            [],
        })
        for step in ONBOARDING_STEPS:
            doc.append("steps", step)
        doc.insert(ignore_permissions=True)
    else:
        doc = frappe.get_doc("Module Onboarding", ONBOARDING_NAME)
        doc.set("steps", [])
        for step in ONBOARDING_STEPS:
            doc.append("steps", step)
        doc.save(ignore_permissions=True)

    # Link the sidebar to this onboarding
    if frappe.db.exists("Workspace Sidebar", WORKSPACE_NAME):
        frappe.db.set_value("Workspace Sidebar", WORKSPACE_NAME,
                            "module_onboarding", ONBOARDING_NAME)


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

        for dt in _all_desired - existing_doctypes:
            if frappe.db.exists("DocType", dt):
                pmap = READ_ONLY_MAP if dt in _infra_set else PERMISSION_MAP
                frappe.get_doc({
                    "doctype":     "Custom DocPerm",
                    "parent":      dt,
                    "parenttype":  "DocType",
                    "parentfield": "permissions",
                    "role":        role,
                    **pmap
                }).insert(ignore_permissions=True)

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

def restrict_standard_workspaces():
    for ws_name in STANDARD_WORKSPACES_TO_HIDE:
        if not frappe.db.exists("Workspace", ws_name):
            continue
        ws = frappe.get_doc("Workspace", ws_name)
        original_count = len(ws.roles)
        ws.roles = [r for r in ws.roles if r.role not in set(ROLES)]
        if len(ws.roles) != original_count:
            ws.save(ignore_permissions=True)


# ── Branding ──────────────────────────────────────────────────────────────────

def configure_branding():
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

    _safe_set("Navbar Settings",  "app_logo",     branding.LOGO_HOR)
    _safe_set("Website Settings", "app_logo",     branding.LOGO_SQUARE)
    _safe_set("Website Settings", "banner_image", branding.LOGO_HOR)
    _safe_set("Website Settings", "brand_html",
              f'<img src="{branding.LOGO_HOR}" alt="{branding.APP_NAME}" style="height:32px">')
    _safe_set("Website Settings", "splash_image", branding.LOGO_SQUARE)
    _safe_set("System Settings",  "favicon",      branding.FAVICON)
    _safe_set("Website Settings", "favicon",      branding.FAVICON)
    _safe_set("System Settings",  "app_name",     branding.APP_NAME)
    _safe_set("Website Settings", "app_name",     branding.APP_NAME)


# ── Login redirect ────────────────────────────────────────────────────────────

def configure_login_redirect(config):
    email = config["ALAIY_OS_ADMIN_EMAIL"]
    if frappe.db.exists("User", email):
        set_user_landing(email)


def set_user_landing(user):
    """
    Point a user at the Alaiy OS workspace on login.

    Frappe v16 uses `default_workspace` (Link to Workspace → stores "Alaiy OS").
    Older versions used `home_page` (route string).
    Set whichever field exists so this never crashes on migrate.
    """
    meta = frappe.get_meta("User")
    if meta.has_field("default_workspace"):
        frappe.db.set_value("User", user, "default_workspace", WORKSPACE_NAME)
    elif meta.has_field("home_page"):
        frappe.db.set_value("User", user, "home_page", "/app/os")
