"""Role model for Alaiy OS MCP tools.

Single source of truth for (a) the roles this app owns and (b) which roles may
invoke each tool. The tool base class (`assistant_tools._base.AlaiyTool`) reads
`roles_for()` to gate `execute()`; `setup/install.py` reads `ALAIY_ROLES` to
create the roles idempotently on install/migrate.

Design:
- SUPERUSER_ROLES bypass every per-tool check (site admins + the existing
  Alaiy OS manager role). Any tool is callable by these.
- A tool with an empty allow-list is treated as "superuser only" (fail closed),
  never "everyone".
- Dangerous, hard-to-reverse tools are additionally gated inside their own
  `run()` (e.g. cancel_order requires Alaiy Admin for a real cancel, while a
  dry-run preview is allowed for Alaiy Ops). Keeping that nuance in the tool
  keeps this table declarative.
- TOOL_ROLES below covers only the tools alaiy_os itself ships. Apps that
  contribute their own tools through the `assistant_tools` hook declare their
  roles through the `assistant_tool_roles` hook instead of editing this file:

      assistant_tool_roles = {
          "run_enrichment_agent": ["Alaiy Catalogue"],
      }

  Frappe merges that dict across every installed app, so an agent/connector
  app's tools carry their own permissions in and out with the app.
"""

import frappe

# ── Roles this app owns ──────────────────────────────────────────────────────
ALAIY_ADMIN = "Alaiy Admin"
ALAIY_OPS = "Alaiy Ops"
ALAIY_CATALOGUE = "Alaiy Catalogue"
ALAIY_ANALYST = "Alaiy Analyst"

# Created idempotently on install/migrate.
ALAIY_ROLES = (ALAIY_ADMIN, ALAIY_OPS, ALAIY_CATALOGUE, ALAIY_ANALYST)

# Roles that may call any tool. "System Manager" is Frappe's site admin;
# "OS Manager" is Alaiy OS core's existing manager role (alaiy_os.constants.roles).
SUPERUSER_ROLES = ("System Manager", "OS Manager", ALAIY_ADMIN)

# ── Per-tool allow-list (any-of). Keyed by the tool's MCP name. ──────────────
# SUPERUSER_ROLES are implicitly allowed everywhere and are NOT repeated here.
TOOL_ROLES = {
    # Channel tools
    "sync_channel": (ALAIY_OPS,),
    "get_channel_sync_status": (ALAIY_OPS, ALAIY_ANALYST),
    # Catalogue (read-only)
    "get_catalogue_health": (ALAIY_CATALOGUE, ALAIY_ANALYST),
    # Order tools
    # cancel_order: dry-run preview allowed for Ops; a real cancel is gated to
    # Alaiy Admin inside the tool itself.
    "cancel_order": (ALAIY_OPS,),
}


def _hook_roles(tool_name):
    """Extra allowed roles contributed by another app's `assistant_tool_roles`.

    Fails closed: any problem resolving the hook yields no extra roles rather
    than widening access.
    """
    try:
        hooked = frappe.get_hooks("assistant_tool_roles") or {}
    except Exception:
        return ()
    entry = hooked.get(tool_name) or ()
    if isinstance(entry, str):
        return (entry,)
    return tuple(entry)


def roles_for(tool_name):
    """Allowed roles for a tool = superusers + its allow-list + hooked roles."""
    allowed = list(SUPERUSER_ROLES) + list(TOOL_ROLES.get(tool_name, ()))
    for role in _hook_roles(tool_name):
        if role not in allowed:
            allowed.append(role)
    return tuple(allowed)


def ensure_roles():
    """Create the Alaiy roles if absent. Idempotent; safe on every migrate."""
    for role_name in ALAIY_ROLES:
        if frappe.db.exists("Role", role_name):
            continue
        frappe.get_doc(
            {
                "doctype": "Role",
                "role_name": role_name,
                "desk_access": 1,
            }
        ).insert(ignore_permissions=True)
