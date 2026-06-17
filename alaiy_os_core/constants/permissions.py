"""
AlaiyOS DocType permission definitions.

Consumed by setup/install.py:reconcile_doctype_permissions().

  TARGET_DOCTYPES     — business DocTypes that get full CRUD (PERMISSION_MAP)
  DESK_INFRA_DOCTYPES — Frappe internals that get read-only access (READ_ONLY_MAP)
                        so the desk boots and renders forms for AlaiyOS users.
"""

# Full read/write permission map for business DocTypes.
PERMISSION_MAP = {
    "read": 1, "write": 1, "create": 1, "delete": 0,
    "submit": 1, "cancel": 1, "amend": 1,
    "report": 1, "export": 1, "import": 0,
    "print": 1, "email": 1,
}

# Read-only permission map for Frappe desk-infrastructure DocTypes.
# AlaiyOS users need to read these for the desk to function but must NOT
# create, edit, or delete Frappe internals.
READ_ONLY_MAP = {
    "read": 1, "write": 0, "create": 0, "delete": 0,
    "submit": 0, "cancel": 0, "amend": 0,
    "report": 1, "export": 0, "import": 0,
    "print": 0, "email": 0,
}

TARGET_DOCTYPES = [
    # ── Stock ──────────────────────────────────
    "Stock Entry",
    "Stock Entry Detail",
    "Stock Entry Type",
    "Item",
    "Item Default",
    "Item Barcode",
    "Item Group",
    "Item Attribute",
    "Item Attribute Value",
    "Item Price",
    "Item Variant Attribute",
    "Brand",
    "Stock Reconciliation",
    "Stock Reconciliation Item",
    "Purchase Receipt",
    "Purchase Receipt Item",

    # ── Selling ────────────────────────────────
    "Sales Order",
    "Sales Order Item",
    "Sales Invoice",
    "Sales Invoice Item",
    "Packed Item",
    "Price List",
    "Pricing Rule",
    "Pricing Rule Detail",
    "Customer",
    "Customer Detail",
    "Customer Group",
    "Address",
    "Contact",
    "Contact Email",
    "Contact Phone",
    "UTM Source",

    # ── Buying ─────────────────────────────────
    "Purchase Order",
    "Purchase Order Item",
    "Purchase Invoice",
    "Purchase Invoice Item",
    "Supplier",
    "Supplier Group",

    # ── Settings (Single DocTypes) ──────────────
    "Stock Settings",
    "Item Variant Settings",
    "Selling Settings",
    "Buying Settings",
    "Accounts Settings",
    "Global Defaults",
    "System Settings",

    # ── Organisation ───────────────────────────
    "Company",
    "Letter Head",
    "Email Account",
    "Currency Exchange",

    # ── Users ──────────────────────────────────
    "User",
    "Role",

    # ── Audits (Log DocTypes — read only) ──────
    "Activity Log",
    "Permission Log",
    "Access Log",
    "Error Log",                      # Dependency of Activity Log views

    # ── Shared dependencies ─────────────────────
    "UOM",
    "UOM Conversion Detail",
    "Currency",
    "Company",
    "Warehouse",
    "Cost Center",
    "Tax Category",
    "Account",
    "Payment Terms Template",
    "Terms and Conditions",
]

# Frappe desk infrastructure DocTypes that require read-only Custom DocPerm
# records so the desk boots and renders forms correctly for AlaiyOS users.
#
# WHY THESE ARE NEEDED
# --------------------
# When an AlaiyOS user loads the desk, Frappe checks has_permission() for
# every DocType it tries to read — including internal ones like Page, Report,
# and DocType itself. Without an explicit Custom DocPerm (or a standard
# DocPerm that covers the AlaiyOS roles), those checks fail and produce the
# error: "User does not have doctype access via role permission for document
# <DocType>".
DESK_INFRA_DOCTYPES = [
    # ── Workspace ────────────────────────────────────────────────────────────
    # Needed so getpage / workspace module can load the workspace document.
    "Workspace",
    "Workspace Link",
    "Workspace Shortcut",
    "Workspace Sidebar",
    "Workspace Sidebar Item",
    # ── Frappe desk core ────────────────────────────────────────────────────
    "Page",
    "Report",
    "DocType",
    "Module Def",
    "Custom Field",
    "Property Setter",
    "Client Script",
    "Server Script",
    # ── Notifications ───────────────────────────────────────────────────────
    "Notification",
    "Notification Log",
    "Energy Point Log",
    # ── Printing ────────────────────────────────────────────────────────────
    "Print Format",
    "Print Settings",
    # ── System ──────────────────────────────────────────────────────────────
    "System Settings",
    "Installed Application",
    # ── User management ─────────────────────────────────────────────────────
    "User Permission",
    "Role Profile",
    "User Type",
]
