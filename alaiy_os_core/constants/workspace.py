"""
AlaiyOS workspace definition — single source of truth for the Alaiy OS
workspace layout (shortcuts + link cards + sidebar).

Consumed by setup/install.py:create_or_update_workspace() and
create_or_update_workspace_sidebar().
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

WORKSPACE_SHORTCUTS = [
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "Ask Alaiy",   "color": "purple"},
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "Dashboard",   "color": "blue"},
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "My Pinned",   "color": "green"},
    # Settings — JS intercepts this click; link_to is a placeholder only
    {"type": "DocType", "link_to": "Stock Settings",
        "label": "Settings",    "color": "grey"},
]

WORKSPACE_LINKS = [
    # ── INVENTORY ──────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Inventory", "icon": "package"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Entry",             "label": "Stock Entry"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item",                    "label": "Products"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Group",              "label": "Item Group"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Attribute",          "label": "Item Attribute"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Price",              "label": "Item Price"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Variant Attribute",  "label": "Item Variant Details"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Brand",                   "label": "Brand"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Reconciliation",    "label": "Stock Reconciliation"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Purchase Receipt",        "label": "Purchase Receipt"},

    # ── ORDERS ─────────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Orders", "icon": "briefcase"},
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

    # ── PURCHASE ───────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Purchase", "icon": "shopping-cart"},
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

# Sidebar items for the left-panel navigation of the Alaiy OS workspace.
# The Workspace Sidebar record (name="Alaiy OS", for_user="") is the global
# default sidebar — empty for_user means all users on this workspace see it.
WORKSPACE_SIDEBAR_ITEMS = [
    # Top-level action buttons (dummy targets; JS intercepts Settings)
    {"type": "Link", "link_type": "Workspace", "link_to": WORKSPACE_NAME,
     "label": "Ask Alaiy",          "child": 0, "indent": 0},
    {"type": "Link", "link_type": "Workspace", "link_to": WORKSPACE_NAME,
     "label": "Dashboard",          "child": 0, "indent": 0},
    {"type": "Link", "link_type": "Workspace", "link_to": WORKSPACE_NAME,
     "label": "My Pinned",          "child": 0, "indent": 0},

    # Inventory section
    {"type": "Section Break", "label": "Inventory",          "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Stock Entry",            "label": "Stock Entry",          "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Item",                   "label": "Products",             "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Group",             "label": "Item Group",           "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Attribute",         "label": "Item Attribute",       "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Price",             "label": "Item Price",           "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Variant Attribute", "label": "Item Variant Details", "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Brand",                  "label": "Brand",                "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Stock Reconciliation",   "label": "Stock Reconciliation", "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Purchase Receipt",       "label": "Purchase Receipt",     "child": 1},

    # Orders section
    {"type": "Section Break", "label": "Orders",             "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Sales Order",    "label": "Sales Order",    "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Sales Invoice",  "label": "Sales Invoice",  "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Price List",     "label": "Price List",     "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Pricing Rule",   "label": "Pricing Rule",   "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Customer",       "label": "Customers",      "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Customer Group", "label": "Customer Groups","child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Address",        "label": "Address",        "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Contact",        "label": "Contact",        "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "UTM Source",     "label": "UTM Source",     "child": 1},

    # Purchase section
    {"type": "Section Break", "label": "Purchase",           "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Purchase Order",   "label": "Purchase Order",   "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Purchase Invoice", "label": "Purchase Invoice", "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Purchase Receipt", "label": "Purchase Receipt", "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Supplier",         "label": "Supplier",         "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Supplier Group",   "label": "Supplier Group",   "child": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Contact",          "label": "Contacts",         "child": 1},

    # Bottom actions
    {"type": "Link", "link_type": "Workspace", "link_to": WORKSPACE_NAME,
     "label": "Reports & Analytics", "child": 0, "indent": 0},
    {"type": "Link", "link_type": "Workspace", "link_to": WORKSPACE_NAME,
     "label": "Settings",            "child": 0, "indent": 0},
]
