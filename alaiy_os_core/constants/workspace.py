"""
AlaiyOS workspace definition — single source of truth for the Alaiy OS
workspace layout (shortcuts + link cards + sidebar).

Consumed by setup/install.py:create_or_update_workspace() and
create_or_update_workspace_sidebar().

Keep sidebar section labels and DocType links in sync with
public/constants/workspace_config.js (the JS counterpart).
"""

WORKSPACE_NAME = "OS"
WORKSPACE_ROUTE = "os"  # URL slug: /desk/os

WORKSPACE_SHORTCUTS = [
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "Ask Alaiy",   "color": "purple"},
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "Dashboard",   "color": "blue"},
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "My Pinned",   "color": "green"},
]

WORKSPACE_LINKS = [
    # ── INVENTORY ──────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Inventory", "icon": "archive"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Entry",          "label": "Stock Entry"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Reconciliation", "label": "Stock Reconciliation"},

    # ── CATALOG (includes pricing items) ───────────────────────────────────────
    {"type": "Card Break", "label": "Catalog", "icon": "grid"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item",            "label": "Products"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Group",      "label": "Item Group"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Attribute",  "label": "Item Attribute"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Brand",           "label": "Brand"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Price",      "label": "Item Price"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Price List",      "label": "Price List"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Pricing Rule",    "label": "Pricing Rule"},

    # ── SALES ──────────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Sales", "icon": "trending-up"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Sales Order",   "label": "Sales Order"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Sales Invoice", "label": "Sales Invoice"},

    # ── PROCUREMENT (Purchase Receipt moved here from Inventory) ───────────────
    {"type": "Card Break", "label": "Procurement", "icon": "package-search"},
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

    # ── CUSTOMERS (Contact removed; Contacts consolidated from bottom) ──────────
    {"type": "Card Break", "label": "Customers", "icon": "users"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Customer",       "label": "Customer"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Customer Group", "label": "Customer Group"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Address",        "label": "Address"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "UTM Source",     "label": "UTM Source"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Contact",        "label": "Contacts"},

    # ── BOTTOM ────────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "More", "icon": "bar-chart"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Entry",    "label": "Reports & Analytics"},

    # ── SETTINGS ──────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Settings", "icon": "settings"},
    {"type": "Link", "link_type": "Page",
        "link_to": "connector-settings", "label": "Connectors"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Cloudstore Sync Log", "label": "Sync Log"},
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
    {"type": "Section Break", "label": "Inventory",
        "icon": "archive",        "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Stock Entry",
     "label": "Stock Entry",          "child": 1, "icon": "package-plus"},
    {"type": "Link", "link_type": "DocType", "link_to": "Stock Reconciliation",
     "label": "Stock Reconciliation", "child": 1, "icon": "clipboard-check"},

    # Catalog (pricing items included; no separate Pricing section)
    {"type": "Section Break", "label": "Catalog",
        "icon": "grid",           "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Item",
     "label": "Products",       "child": 1, "icon": "package"},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Group",
     "label": "Item Group",     "child": 1, "icon": "boxes"},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Attribute",
     "label": "Item Attribute", "child": 1, "icon": "list-filter"},
    {"type": "Link", "link_type": "DocType", "link_to": "Brand",
     "label": "Brand",         "child": 1, "icon": "badge"},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Price",
     "label": "Item Price",    "child": 1, "icon": "tag"},
    {"type": "Link", "link_type": "DocType", "link_to": "Price List",
     "label": "Price List",    "child": 1, "icon": "tags"},
    {"type": "Link", "link_type": "DocType", "link_to": "Pricing Rule",
     "label": "Pricing Rule",  "child": 1, "icon": "badge-percent"},

    # Sales
    {"type": "Section Break", "label": "Sales",
        "icon": "trending-up",    "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Sales Order",
     "label": "Sales Order",   "child": 1, "icon": "shopping-cart"},
    {"type": "Link", "link_type": "DocType", "link_to": "Sales Invoice",
     "label": "Sales Invoice", "child": 1, "icon": "receipt"},

    # Procurement (Purchase Receipt moved here from Inventory)
    {"type": "Section Break", "label": "Procurement",
        "icon": "package-search", "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Purchase Order",
     "label": "Purchase Order",   "child": 1, "icon": "file-input"},
    {"type": "Link", "link_type": "DocType", "link_to": "Purchase Invoice",
     "label": "Purchase Invoice", "child": 1, "icon": "file-text"},
    {"type": "Link", "link_type": "DocType", "link_to": "Purchase Receipt",
     "label": "Purchase Receipt", "child": 1, "icon": "package-check"},
    {"type": "Link", "link_type": "DocType", "link_to": "Supplier",
     "label": "Supplier",         "child": 1, "icon": "truck"},
    {"type": "Link", "link_type": "DocType", "link_to": "Supplier Group",
     "label": "Supplier Group",   "child": 1, "icon": "network"},

    # Customers (Contact removed; Contacts consolidated from bottom standalone)
    # Label "Customer" (singular) avoids ALAIY_SKIP_LABELS collision with section "Customers".
    {"type": "Section Break", "label": "Customers",
        "icon": "users",          "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Customer",
     "label": "Customer",        "child": 1, "icon": "user"},
    {"type": "Link", "link_type": "DocType", "link_to": "Customer Group",
     "label": "Customer Group", "child": 1, "icon": "users-round"},
    {"type": "Link", "link_type": "DocType", "link_to": "Address",
     "label": "Address",         "child": 1, "icon": "map-pinned"},
    {"type": "Link", "link_type": "DocType", "link_to": "UTM Source",
     "label": "UTM Source",      "child": 1, "icon": "mouse-pointer-click"},
    {"type": "Link", "link_type": "DocType", "link_to": "Contact",
     "label": "Contacts",        "child": 1, "icon": "book-user"},

    # Bottom standalone actions
    {"type": "Link", "link_type": "Workspace", "link_to": WORKSPACE_NAME,
     "label": "Reports & Analytics", "child": 0, "indent": 0, "icon": "chart-column"},

    # Settings section
    {"type": "Section Break", "label": "Settings",
        "icon": "settings", "child": 0, "indent": 1},
    {"type": "Link", "link_type": "Page", "link_to": "connector-settings",
     "label": "Connectors", "child": 1, "icon": "plug"},
    {"type": "Link", "link_type": "DocType", "link_to": "Cloudstore Sync Log",
     "label": "Sync Log", "child": 1, "icon": "activity"},
]
