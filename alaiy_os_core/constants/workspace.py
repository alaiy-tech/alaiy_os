"""
AlaiyOS workspace definition — single source of truth for the Alaiy OS
workspace layout (shortcuts + link cards + sidebar).

Consumed by setup/install.py:create_or_update_workspace() and
create_or_update_workspace_sidebar().

Keep sidebar section labels and DocType links in sync with
public/constants/workspace_config.js (the JS counterpart).
"""

from alaiy_os_core.constants.branding import LOGO_SQUARE

WORKSPACE_NAME  = "OS"
WORKSPACE_ROUTE = "os"
LOGO_URL        = LOGO_SQUARE

# Standard ERPNext workspaces from which AlaiyOS roles are removed on every
# migrate, so they don't appear in the desk sidebar for AlaiyOS users.
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
        "link_to": "Stock Entry",          "label": "Stock Entry"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Reconciliation", "label": "Stock Reconciliation"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Purchase Receipt",     "label": "Purchase Receipt"},

    # ── CATALOG ────────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Catalog", "icon": "box"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item",            "label": "Products"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Group",      "label": "Item Group"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Attribute",  "label": "Item Attribute"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Brand",           "label": "Brand"},

    # ── SALES ──────────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Sales", "icon": "shopping-cart"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Sales Order",   "label": "Sales Order"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Sales Invoice", "label": "Sales Invoice"},

    # ── CUSTOMERS ──────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Customers", "icon": "users"},
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

    # ── PROCUREMENT ────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Procurement", "icon": "truck"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Purchase Order",   "label": "Purchase Order"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Purchase Invoice", "label": "Purchase Invoice"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Supplier",         "label": "Supplier"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Supplier Group",   "label": "Supplier Group"},

    # ── PRICING ────────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Pricing", "icon": "tag"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Price",   "label": "Item Price"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Price List",   "label": "Price List"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Pricing Rule", "label": "Pricing Rule"},

    # ── BOTTOM DUMMIES ─────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "More", "icon": "bar-chart"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Entry",    "label": "Reports & Analytics"},
    # Settings — click intercepted by alaiy_settings.js
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Settings", "label": "Settings"},
]

# Sidebar items — mirrors ALAIY_SIDEBAR_CONFIG in public/constants/workspace_config.js.
# Keep both in sync.  icon names are Lucide/Frappe icon names.
WORKSPACE_SIDEBAR_ITEMS = [
    # Top standalone actions
    {"type": "Link", "link_type": "Workspace", "link_to": WORKSPACE_NAME,
     "label": "Ask Alaiy",  "child": 0, "indent": 0, "icon": "sparkles"},
    {"type": "Link", "link_type": "Workspace", "link_to": WORKSPACE_NAME,
     "label": "Dashboard",  "child": 0, "indent": 0, "icon": "layout-dashboard"},
    {"type": "Link", "link_type": "Workspace", "link_to": WORKSPACE_NAME,
     "label": "My Pinned",  "child": 0, "indent": 0, "icon": "pin"},

    # Inventory
    {"type": "Section Break", "label": "Inventory",           "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Stock Entry",
     "label": "Stock Entry",          "child": 1, "icon": "package-plus"},
    {"type": "Link", "link_type": "DocType", "link_to": "Stock Reconciliation",
     "label": "Stock Reconciliation", "child": 1, "icon": "clipboard-check"},
    {"type": "Link", "link_type": "DocType", "link_to": "Purchase Receipt",
     "label": "Purchase Receipt",     "child": 1, "icon": "package-check"},

    # Catalog
    {"type": "Section Break", "label": "Catalog",             "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Item",
     "label": "Products",     "child": 1, "icon": "package"},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Group",
     "label": "Item Group",   "child": 1, "icon": "boxes"},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Attribute",
     "label": "Item Attribute","child": 1, "icon": "list-filter"},
    {"type": "Link", "link_type": "DocType", "link_to": "Brand",
     "label": "Brand",        "child": 1, "icon": "badge"},

    # Sales
    {"type": "Section Break", "label": "Sales",               "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Sales Order",
     "label": "Sales Order",   "child": 1, "icon": "shopping-cart"},
    {"type": "Link", "link_type": "DocType", "link_to": "Sales Invoice",
     "label": "Sales Invoice", "child": 1, "icon": "receipt"},

    # Customers
    {"type": "Section Break", "label": "Customers",           "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Customer",
     "label": "Customers",        "child": 1, "icon": "users"},
    {"type": "Link", "link_type": "DocType", "link_to": "Customer Group",
     "label": "Customer Groups",  "child": 1, "icon": "user-round"},
    {"type": "Link", "link_type": "DocType", "link_to": "Address",
     "label": "Address",          "child": 1, "icon": "map-pinned"},
    {"type": "Link", "link_type": "DocType", "link_to": "Contact",
     "label": "Contact",          "child": 1, "icon": "contact"},
    {"type": "Link", "link_type": "DocType", "link_to": "UTM Source",
     "label": "UTM Source",       "child": 1, "icon": "mouse-pointer-click"},

    # Procurement
    {"type": "Section Break", "label": "Procurement",         "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Purchase Order",
     "label": "Purchase Order",   "child": 1, "icon": "file-input"},
    {"type": "Link", "link_type": "DocType", "link_to": "Purchase Invoice",
     "label": "Purchase Invoice", "child": 1, "icon": "file-text"},
    {"type": "Link", "link_type": "DocType", "link_to": "Supplier",
     "label": "Supplier",         "child": 1, "icon": "truck"},
    {"type": "Link", "link_type": "DocType", "link_to": "Supplier Group",
     "label": "Supplier Group",   "child": 1, "icon": "network"},

    # Pricing
    {"type": "Section Break", "label": "Pricing",             "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Price",
     "label": "Item Price",   "child": 1, "icon": "tag"},
    {"type": "Link", "link_type": "DocType", "link_to": "Price List",
     "label": "Price List",   "child": 1, "icon": "tags"},
    {"type": "Link", "link_type": "DocType", "link_to": "Pricing Rule",
     "label": "Pricing Rule", "child": 1, "icon": "badge-percent"},

    # Bottom standalone actions
    {"type": "Link", "link_type": "DocType", "link_to": "Contact",
     "label": "Contacts",             "child": 0, "indent": 0, "icon": "book-user"},
    {"type": "Link", "link_type": "Workspace", "link_to": WORKSPACE_NAME,
     "label": "Reports & Analytics",  "child": 0, "indent": 0, "icon": "chart-column"},
    {"type": "Link", "link_type": "Workspace", "link_to": WORKSPACE_NAME,
     "label": "Settings",             "child": 0, "indent": 0, "icon": "settings"},
]
