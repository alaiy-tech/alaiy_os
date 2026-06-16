"""
AlaiyOS Core — Workspace / DocType / Report visibility configuration.

================================================================================
WHY THIS FILE EXISTS
================================================================================
ERPNext ships with dozens of modules, DocTypes, Reports and menu items. Most of
them are irrelevant to an AlaiyOS deployment and only confuse end users. We must
NOT edit ERPNext/Frappe core to hide them (that breaks on every upgrade), so
instead this file acts as the SINGLE SOURCE OF TRUTH for what is visible.

How it is consumed:
  * workspace_manager.patch_workspaces()  -> reads this on every `bench migrate`
    and surgically strips disabled links/shortcuts out of the live Workspace docs.
  * boot.inject_branding_and_restrictions() -> reads the derived "blocked" list
    and injects it into frappe.boot for non-admin users (route guard + UI).
  * permissions.py -> reads the derived "blocked" list to deny direct-URL access.

GOLDEN RULES
  * "Visible" is a WHITELIST. Anything not whitelisted for an enabled workspace
    is considered hidden/blocked for non-System-Administrators.
  * Removing something from the UI never removes its backend behaviour. DocTypes
    such as "Stock Entry" / "Delivery Note" are still used internally by ERPNext
    for stock postings — we only remove their *discoverability*.
  * System Administrators always see everything; nothing here applies to them.
================================================================================
"""

# ------------------------------------------------------------------------------
# WORKSPACE_CONFIG
# ------------------------------------------------------------------------------
# Shape per workspace:
#   "<Workspace Name>": {
#       "enabled": bool,                 # False -> workspace hidden entirely
#       "visible_doctypes": [str, ...],  # DocTypes allowed to show as links/shortcuts
#       "visible_reports":  [str, ...],  # Reports allowed to show as links/shortcuts
#       "visible_pages":    [str, ...],  # (optional) Page links allowed to show
#   }
#
# To toggle a whole workspace on/off in future, just flip "enabled".
# To expose/hide an individual item, add/remove it from the visible_* lists and
# redeploy (`bench migrate`) — the change propagates automatically.
# ------------------------------------------------------------------------------

WORKSPACE_CONFIG = {
    # =========================================================================
    # STOCK — the one workspace AlaiyOS exposes today.
    # =========================================================================
    "Stock": {
        "enabled": True,
        "visible_doctypes": [
            # Masters
            "Item",
            "Item Group",
            "Brand",
            "Warehouse",
            # Transactions
            "Stock Reconciliation",
            "Purchase Receipt",
            # Serial & Batch
            "Batch",
            "Serial No",
            # Settings
            "Stock Settings",
        ],
        "visible_reports": [
            "Stock Ledger",
            "Stock Balance",
            "Stock Summary",
        ],
        # No standalone pages are whitelisted for Stock.
        "visible_pages": [],
    },

    # =========================================================================
    # Other ERPNext workspaces — disabled for now. Flip "enabled" to True and
    # redeploy to bring any of these back. Listed explicitly so the intent is
    # documented and toggling is a one-line change.
    # =========================================================================
    "Accounts": {"enabled": False},
    "Selling": {"enabled": False},
    "Buying": {"enabled": False},
    "Manufacturing": {"enabled": False},
    "CRM": {"enabled": False},
    "Assets": {"enabled": False},
    "Projects": {"enabled": False},
    "Support": {"enabled": False},
    "Quality": {"enabled": False},
    "HR": {"enabled": False},
    "Payroll": {"enabled": False},
    "Loans": {"enabled": False},
    "Healthcare": {"enabled": False},
    "Education": {"enabled": False},
    "Non Profit": {"enabled": False},
    "Agriculture": {"enabled": False},
    "Restaurant": {"enabled": False},
}


# ------------------------------------------------------------------------------
# EXPLICIT STOCK BLOCK LIST
# ------------------------------------------------------------------------------
# The whitelist above already implies everything else is hidden. We ALSO keep an
# explicit, human-readable list of what must be removed from the Stock workspace.
# This is used for two things:
#   1. Documentation / review — reviewers can see exactly what we suppress.
#   2. Runtime enforcement — these DocTypes feed the `blocked_doctypes` boot list
#      and the has_permission hook, so direct-URL access is denied for non-admins.
#
# NOTE: Only *DocTypes* belong here (permissions + routes are DocType-scoped).
# Reports are handled purely by the workspace whitelist (they are not routable
# DocTypes a user can be "denied" via has_permission).
# ------------------------------------------------------------------------------

STOCK_BLOCKED_DOCTYPES = [
    # Masters
    "Product Bundle",
    "Shipping Rule",
    "Item Alternative",
    # Transactions (backend logic preserved; only UI discoverability removed)
    "Material Request",
    "Stock Entry",
    "Delivery Note",
    "Pick List",
    "Delivery Trip",
    # Settings
    "UOM",                       # "Unit of Measure" DocType is named "UOM"
    "Item Variant Settings",
    "Item Attribute",
    "UOM Conversion Factor",
    # Serial & Batch
    "Installation Note",
    "Serial No",                 # NOTE: Serial No IS visible — removed below.
    # Tools
    "Landed Cost Voucher",
    "Packing Slip",
    "Quality Inspection",
    "Quality Inspection Template",
    "Quick Stock Balance",
]

# "Serial No" appears in both visible and (accidentally) the blocked draft above.
# Keep it visible — remove it from the blocked list defensively so the two lists
# can never contradict each other.
STOCK_BLOCKED_DOCTYPES = [d for d in STOCK_BLOCKED_DOCTYPES if d != "Serial No"]


# Reports that must be stripped from the Stock workspace UI (non-admins).
# Used only by the workspace patcher (reports are not has_permission-scoped here).
STOCK_BLOCKED_REPORTS = [
    "Stock Projected Qty",
    "Stock Ageing",
    "Item Price Stock",
    "Warehouse wise Item Balance Age and Value",  # internal name of "Warehouse Wise Stock Balance"
    "Delivery Note Trends",
    "Purchase Receipt Trends",
    "Sales Order Analysis",
    "Purchase Order Analysis",
    "Item Shortage Report",
    "Batch-Wise Balance History",
    "Requested Items To Be Transferred",
    "Batch Item Expiry Status",
    "Itemwise Recommended Reorder Level",
    "Subcontracted Raw Materials To Be Transferred",
    "Subcontracted Item To Be Received",
]


# ------------------------------------------------------------------------------
# DERIVED HELPERS
# ------------------------------------------------------------------------------

def get_blocked_doctypes():
    """
    Return the flat, de-duplicated list of DocTypes that must be blocked for
    non-System-Administrators across ALL configured workspaces.

    Logic:
      * Start with the explicit per-workspace block lists (currently Stock).
      * Never block a DocType that is whitelisted as visible anywhere (safety:
        a DocType visible in one enabled workspace must remain reachable).

    This is the value injected into frappe.boot.blocked_doctypes and consumed by
    permissions.has_permission().
    """
    blocked = set(STOCK_BLOCKED_DOCTYPES)

    # Collect every DocType that is explicitly visible in any ENABLED workspace.
    visible = set()
    for ws in WORKSPACE_CONFIG.values():
        if not ws.get("enabled"):
            continue
        visible.update(ws.get("visible_doctypes", []))

    # Visibility always wins over a stray block entry.
    return sorted(blocked - visible)


def get_blocked_reports():
    """Return the flat list of Reports stripped from workspace UIs (non-admins)."""
    return list(STOCK_BLOCKED_REPORTS)
