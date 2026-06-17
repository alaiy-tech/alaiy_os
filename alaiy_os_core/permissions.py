"""
AlaiyOS Core — Runtime permission enforcement.

================================================================================
WHAT THIS DOES
================================================================================
Two complementary mechanisms protect DocTypes from unauthorised access:

1. ROLE-BASED PERMISSIONS (setup_role_permissions)
   Creates the "Altomoda Stock User" role and assigns it explicit Custom DocPerm
   records for every whitelisted DocType in workspace_config.WORKSPACE_CONFIG.
   This is the *positive* grant: users with only this role can access exactly the
   DocTypes in visible_doctypes and nothing else — Frappe's permission layer
   enforces it natively at every API call.

2. HAS_PERMISSION HOOK (has_blocked_permission)
   Belt-and-suspenders for non-admin users who may have inherited other roles.
   Every DocType in the explicit STOCK_BLOCKED_DOCTYPES list gets a hook that
   returns False for non-System-Administrators regardless of their other roles.

WHY THIS IS SAFE FOR BACKEND LOGIC
ERPNext's internal stock postings create/read docs like "Stock Entry" with
`ignore_permissions=True`. Frappe's permission layer (and therefore both
mechanisms above) is bypassed when ignore_permissions is set, so suppressing
UI access here does NOT break stock calculations or any server-side automation.

REGISTRATION
  * setup_role_permissions() is called from install.run_setup() on every
    `bench migrate`.
  * HAS_PERMISSION_HOOK is imported by hooks.py at module load time.
================================================================================
"""

import frappe

from alaiy_os_core.client.config.workspace_config import (
    WORKSPACE_CONFIG,
    get_blocked_doctypes,
)


# ── Role name ─────────────────────────────────────────────────────────────────
ROLE_NAME = "Altomoda Stock User"

# ── Per-DocType permission flags for the Altomoda Stock User role ──────────────
# Keys mirror Frappe's Custom DocPerm fields. Omitted flags default to 0.
# Only DocTypes that are also in workspace_config.WORKSPACE_CONFIG[*].visible_doctypes
# actually get permissions applied — this dict just declares the *desired* flags.
_DOCTYPE_PERMS = {
    # Full product-catalog management
    "Item":                 {"read": 1, "write": 1, "create": 1, "delete": 1, "report": 1, "export": 1, "print": 1, "email": 1},
    # Reference lists — read-only
    "Item Group":           {"read": 1, "report": 1, "export": 1},
    "Brand":                {"read": 1, "report": 1, "export": 1},
    "Warehouse":            {"read": 1, "report": 1, "export": 1},
    # Full transaction lifecycle
    "Stock Reconciliation": {"read": 1, "write": 1, "create": 1, "submit": 1, "cancel": 1, "amend": 1, "print": 1, "email": 1},
    "Purchase Receipt":     {"read": 1, "write": 1, "create": 1, "submit": 1, "cancel": 1, "amend": 1, "print": 1, "email": 1},
    # Tracking records
    "Batch":                {"read": 1, "write": 1, "create": 1},
    "Serial No":            {"read": 1, "write": 1, "create": 1},
    # Settings — view only
    "Stock Settings":       {"read": 1},
}


# ── Role setup (called from install.run_setup) ─────────────────────────────────

def setup_role_permissions():
    """
    Idempotent: create the Altomoda Stock User role and assign it Custom DocPerm
    records that match the Stock workspace whitelist in workspace_config.py.

    Called from install.run_setup() on every `bench migrate` so that adding a
    DocType to visible_doctypes automatically grants the role access on next deploy.
    """
    try:
        _ensure_role()
        _apply_doctype_permissions()
    except Exception:
        frappe.log_error(
            title="AlaiyOS: setup_role_permissions failed",
            message=frappe.get_traceback(),
        )


def _ensure_role():
    """Create the role if it doesn't exist yet."""
    if frappe.db.exists("Role", ROLE_NAME):
        return
    frappe.get_doc({
        "doctype": "Role",
        "role_name": ROLE_NAME,
        "desk_access": 1,
    }).insert(ignore_permissions=True)


def _apply_doctype_permissions():
    """
    For each DocType in _DOCTYPE_PERMS that is also in the current
    visible_doctypes whitelist, delete any existing Custom DocPerm for our
    role and re-insert a fresh one from config.
    """
    # Collect the current whitelist from config (single source of truth)
    visible = set()
    for ws_cfg in WORKSPACE_CONFIG.values():
        if ws_cfg.get("enabled"):
            visible.update(ws_cfg.get("visible_doctypes", []))

    for doctype, flags in _DOCTYPE_PERMS.items():
        if doctype not in visible:
            continue  # not whitelisted — skip
        if not frappe.db.exists("DocType", doctype):
            continue  # DocType not installed on this site — skip

        # Idempotent: wipe and re-create so config is always authoritative
        frappe.db.delete("Custom DocPerm", {"parent": doctype, "role": ROLE_NAME})

        frappe.get_doc({
            "doctype": "Custom DocPerm",
            "parent": doctype,
            "parenttype": "DocType",
            "parentfield": "permissions",
            "role": ROLE_NAME,
            "permlevel": 0,
            "read":   flags.get("read",   0),
            "write":  flags.get("write",  0),
            "create": flags.get("create", 0),
            "delete": flags.get("delete", 0),
            "submit": flags.get("submit", 0),
            "cancel": flags.get("cancel", 0),
            "amend":  flags.get("amend",  0),
            "report": flags.get("report", 0),
            "export": flags.get("export", 0),
            "print":  flags.get("print",  0),
            "email":  flags.get("email",  0),
            "share":  0,
        }).insert(ignore_permissions=True)


# ── has_permission hook (belt-and-suspenders for explicitly blocked DocTypes) ──

def is_system_admin(user=None):
    """
    True if `user` (default: session user) is a System Administrator.
    Administrator and anyone with the "System Manager" role count as admins.
    """
    user = user or frappe.session.user
    if user == "Administrator":
        return True
    return "System Manager" in frappe.get_roles(user)


def has_blocked_permission(doc=None, ptype=None, user=None, **kwargs):
    """
    Shared has_permission handler registered for every blocked DocType.

    Returns:
      True  -> for System Administrators (full access retained).
      False -> for every other user (access denied; Frappe shows perm error).

    Frappe invokes hook handlers with flexible kwargs, so we accept **kwargs to
    stay compatible across versions.
    """
    user = user or frappe.session.user
    if is_system_admin(user):
        return True
    return False


def build_has_permission_hook():
    """
    Return the dict hooks.py registers under `has_permission`:
        { "<DocType>": ["alaiy_os_core.permissions.has_blocked_permission"], ... }

    Driven entirely by config so toggling a workspace/DocType in
    workspace_config.py automatically adds/removes enforcement on next load.
    """
    path = "alaiy_os_core.permissions.has_blocked_permission"
    return {dt: [path] for dt in get_blocked_doctypes()}


# Pre-built mapping imported by hooks.py at module load time.
HAS_PERMISSION_HOOK = build_has_permission_hook()
