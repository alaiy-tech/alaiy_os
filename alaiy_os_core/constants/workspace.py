"""
AlaiyOS workspace definition — single source of truth for the Alaiy OS
workspace layout (shortcuts + link cards).

Consumed by setup/install.py:create_or_update_workspace().
"""

from alaiy_os_core.constants.branding import LOGO_SQUARE

WORKSPACE_NAME = "Alaiy OS"
WORKSPACE_ROUTE = "alaiy-os"
LOGO_URL = LOGO_SQUARE

# Standard ERPNext workspaces from which AlaiyOS roles are removed on every
# migrate, so they don't appear in the sidebar for AlaiyOS users.
STANDARD_WORKSPACES_TO_HIDE = [
    "Stock", "Selling", "Buying", "Accounting", "HR", "CRM",
    "Manufacturing", "Projects", "Assets", "Quality", "Support",
    "Payroll", "ERPNext Integrations", "Settings", "Users",
    "Build", "Home", "Learn", "Website", "Customization",
]

# The dummy entries (Ask AlaiyOS, Dashboard, My Pinned, Reports & Analytics)
# all point to "Stock Entry" as a placeholder so Frappe renders them without
# throwing a missing-doctype error. They will be replaced with real targets in
# the next iteration. Do not add click handlers or special behaviour to them.
#
# The "Settings" entry is the exception: its click is intercepted by
# alaiy_settings.js, which opens an in-workspace panel instead of navigating.
# Its link_to ("Stock Settings") is just a valid placeholder so Frappe renders
# the card without error.
WORKSPACE_SHORTCUTS = [
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "Ask AlaiyOS", "color": "purple"},
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "Dashboard",   "color": "blue"},
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "My Pinned",   "color": "green"},
    # Settings — JS intercepts this click; link_to is a placeholder only
    {"type": "DocType", "link_to": "Stock Settings",
        "label": "Settings",    "color": "grey"},
]

WORKSPACE_LINKS = [
    # ── STOCK ──────────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Stock", "icon": "package"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Entry",            "label": "Stock Entry"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item",                   "label": "Products"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Group",             "label": "Item Group"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Attribute",         "label": "Item Attribute"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Price",             "label": "Item Price"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Variant Attribute", "label": "Item Variant Details"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Brand",                  "label": "Brand"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Reconciliation",   "label": "Stock Reconciliation"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Purchase Receipt",       "label": "Purchase Receipt"},

    # ── SELLING ────────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Selling", "icon": "briefcase"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Sales Order",    "label": "Sales Order"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Sales Invoice",  "label": "Sales Invoice"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Price List",     "label": "Price List"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Pricing Rule",   "label": "Pricing Rule"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Customer",       "label": "Customers"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Customer Group", "label": "Customer Groups"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Address",        "label": "Address"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Contact",        "label": "Contact"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "UTM Source",     "label": "UTM Source"},

    # ── BUYING ─────────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Buying", "icon": "shopping-cart"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Purchase Order",   "label": "Purchase Order"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Purchase Invoice", "label": "Purchase Invoice"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Purchase Receipt", "label": "Purchase Receipt"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Supplier",         "label": "Supplier"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Supplier Group",   "label": "Supplier Group"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Contact",          "label": "Contacts"},

    # ── BOTTOM DUMMIES ─────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "More", "icon": "bar-chart"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Entry", "label": "Reports & Analytics"},
    # Settings — click intercepted by alaiy_settings.js (opens in-workspace panel)
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Settings", "label": "Settings"},
]
