"""
AlaiyOS Core — Runtime permission enforcement.

================================================================================
WHAT THIS DOES
================================================================================
Even after we strip a DocType from the workspace UI, a user could still reach it
by typing the URL (e.g. /app/stock-entry) or via a saved link. This module adds a
`has_permission` hook for each blocked DocType so that:

  * System Administrators  -> unaffected (full access retained).
  * Everyone else          -> denied, so Frappe shows its standard permission
                              error instead of a broken/empty page.

WHY THIS IS SAFE FOR BACKEND LOGIC
ERPNext's internal stock postings create/read docs like "Stock Entry" with
`ignore_permissions=True`. Frappe's permission layer (and therefore this hook)
is bypassed when ignore_permissions is set, so suppressing UI access here does
NOT break stock calculations or any server-side automation.

A has_permission handler returning False = deny; returning True = allow. We only
ever return False for non-admin users; for admins we return True so they always
retain access.

REGISTRATION
hooks.py maps every blocked DocType to the dotted path of `has_blocked_permission`
via the HAS_PERMISSION_HOOK dict. Frappe needs importable string paths (not
in-memory callables), so all blocked types share one handler function.
================================================================================
"""

import frappe

from alaiy_os_core.config.workspace_config import get_blocked_doctypes


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
