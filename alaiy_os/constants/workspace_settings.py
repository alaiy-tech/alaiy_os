"""
Alaiy OS — OS Settings workspace definition.
Provisioned by setup/install.py alongside the main OS workspace.
"""

SETTINGS_WORKSPACE_NAME = "OS Settings"
SETTINGS_WORKSPACE_ROUTE = "os-settings"

SETTINGS_WORKSPACE_SHORTCUTS = []

SETTINGS_WORKSPACE_LINKS = [
    # ── ORGANISATION ───────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Organisation", "icon": "building-2"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Email Account",           "label": "Email Account"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Email Template",          "label": "Email Template"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Letter Head",             "label": "Letter Head"},

    # ── ACCOUNTS SETTINGS ──────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Accounts Settings", "icon": "settings-2"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Accounts Settings",       "label": "Accounts Settings"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Journal Entry Template",  "label": "Journal Entry Template"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Currency Exchange",       "label": "Currency Exchange"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Dunning Type",            "label": "Dunning Type"},

    # ── INVENTORY SETTINGS ─────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Inventory Settings", "icon": "settings-2"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Settings",              "label": "Stock Settings"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Reposting Settings",    "label": "Stock Reposting Settings"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Customs Tariff Number",       "label": "Customs Tariff Number"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Inventory Dimension",         "label": "Inventory Dimension"},

    # ── CATALOG SETTINGS ───────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Catalog Settings", "icon": "git-branch"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Variant Settings",       "label": "Item Variant Settings"},

    # ── SALES SETTINGS ─────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Sales Settings", "icon": "trending-up"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Selling Settings",            "label": "Selling Settings"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "POS Settings",                "label": "POS Settings"},

    # ── SHIPPING SETTINGS ──────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Shipping Settings", "icon": "package"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Delivery Settings",           "label": "Delivery Settings"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Shipment Parcel Template",    "label": "Shipment Parcel Template"},

    # ── PROCUREMENT SETTINGS ───────────────────────────────────────────────────
    {"type": "Card Break", "label": "Procurement Settings", "icon": "shopping-bag"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Buying Settings",             "label": "Buying Settings"},

    # ── FINANCE SETTINGS ───────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Finance Settings", "icon": "credit-card"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Payment Gateway Account",             "label": "Payment Gateway Account"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Payment Terms Template",              "label": "Payment Terms Template"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Mode of Payment",                     "label": "Mode of Payment"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Bank",                                "label": "Bank"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Bank Account",                        "label": "Bank Account"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Bank Account Type",                   "label": "Bank Account Type"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Bank Account Subtype",                "label": "Bank Account Subtype"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Bank Transaction Mapping",            "label": "Bank Transaction Mapping"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Purchase Taxes and Charges Template", "label": "Purchase Tax Templates"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Sales Taxes and Charges Template",    "label": "Sales Tax Templates"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Item Tax Template",                   "label": "Item Tax Template"},

    # ── CUSTOMERS SETTINGS ─────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Customers Settings", "icon": "users"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Subscription Settings",       "label": "Subscription Settings"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Contract Template",           "label": "Contract Template"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Appointment Booking Settings", "label": "Appointment Booking Settings"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "CRM Settings",                "label": "CRM Settings"},

    # ── USERS ──────────────────────────────────────────────────────────────────
    {"type": "Card Break", "label": "Users", "icon": "user"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "User",                        "label": "User"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Role",                        "label": "Role"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "User Permission",             "label": "User Permission"},

    # ── GENERAL SETTINGS ───────────────────────────────────────────────────────
    {"type": "Card Break", "label": "General Settings", "icon": "settings"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Country",                     "label": "Country"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Gender",                      "label": "Gender"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Address Template",            "label": "Address Template"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Salutation",                  "label": "Salutation"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Authorization Rule",          "label": "Authorization Rule"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Global Defaults",             "label": "Global Defaults"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Party Type",                  "label": "Party Type"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Territory",                   "label": "Territory"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Incoterm",                    "label": "Incoterm"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Terms and Conditions",        "label": "Terms and Conditions"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Webhook",                     "label": "Webhook"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Module Profile",              "label": "Module Profile"},
    {"type": "Link", "link_type": "DocType",
        "link_to": "Notification",                "label": "Notification"},

    # ── CONNECTORS ─────────────────────────────────────────────────────────────
    # One Link per row in OS Connector Registry, injected at provisioning time
    # by setup/install.py — see _build_connector_workspace_links(). No items
    # are hard-coded here.
]

SETTINGS_WORKSPACE_SIDEBAR_ITEMS = [
    # ── Top: back to main OS workspace ────────────────────────────────────────
    {"type": "Link", "link_type": "Workspace", "link_to": "OS",
     "label": "Dashboard",      "child": 0, "indent": 0, "icon": "layout-dashboard"},

    # ── Organisation ──────────────────────────────────────────────────────────
    {"type": "Section Break", "label": "Organisation",
        "icon": "building-2",       "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Email Account",
     "label": "Email Account",    "child": 1, "icon": "mail"},
    {"type": "Link", "link_type": "DocType", "link_to": "Email Template",
     "label": "Email Template",   "child": 1, "icon": "file-text"},
    {"type": "Link", "link_type": "DocType", "link_to": "Letter Head",
     "label": "Letter Head",      "child": 1, "icon": "scroll"},

    # ── Accounts Settings ─────────────────────────────────────────────────────
    {"type": "Section Break", "label": "Accounts Settings",
        "icon": "settings-2",       "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Accounts Settings",
     "label": "Accounts Settings",     "child": 1, "icon": "settings-2"},
    {"type": "Link", "link_type": "DocType", "link_to": "Journal Entry Template",
     "label": "Journal Entry Template", "child": 1, "icon": "pencil"},
    {"type": "Link", "link_type": "DocType", "link_to": "Currency Exchange",
     "label": "Currency Exchange",     "child": 1, "icon": "dollar-sign"},
    {"type": "Link", "link_type": "DocType", "link_to": "Dunning Type",
     "label": "Dunning Type",          "child": 1, "icon": "bell"},

    # ── Inventory Settings ────────────────────────────────────────────────────
    {"type": "Section Break", "label": "Inventory Settings",
        "icon": "settings-2",       "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Stock Settings",
     "label": "Stock Settings",            "child": 1, "icon": "settings-2"},
    {"type": "Link", "link_type": "DocType", "link_to": "Stock Reposting Settings",
     "label": "Stock Reposting Settings",  "child": 1, "icon": "rotate-ccw"},
    {"type": "Link", "link_type": "DocType", "link_to": "Customs Tariff Number",
     "label": "Customs Tariff Number",     "child": 1, "icon": "hash"},
    {"type": "Link", "link_type": "DocType", "link_to": "Inventory Dimension",
     "label": "Inventory Dimension",       "child": 1, "icon": "box"},

    # ── Catalog Settings ──────────────────────────────────────────────────────
    {"type": "Section Break", "label": "Catalog Settings",
        "icon": "git-branch",       "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Variant Settings",
     "label": "Item Variant Settings",     "child": 1, "icon": "git-branch"},

    # ── Sales Settings ────────────────────────────────────────────────────────
    {"type": "Section Break", "label": "Sales Settings",
        "icon": "trending-up",      "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Selling Settings",
     "label": "Selling Settings",          "child": 1, "icon": "trending-up"},
    {"type": "Link", "link_type": "DocType", "link_to": "POS Settings",
     "label": "POS Settings",              "child": 1, "icon": "credit-card"},

    # ── Shipping Settings ─────────────────────────────────────────────────────
    {"type": "Section Break", "label": "Shipping Settings",
        "icon": "package",          "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Delivery Settings",
     "label": "Delivery Settings",         "child": 1, "icon": "package"},
    {"type": "Link", "link_type": "DocType", "link_to": "Shipment Parcel Template",
     "label": "Shipment Parcel Template",  "child": 1, "icon": "box"},

    # ── Procurement Settings ──────────────────────────────────────────────────
    {"type": "Section Break", "label": "Procurement Settings",
        "icon": "shopping-bag",     "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Buying Settings",
     "label": "Buying Settings",           "child": 1, "icon": "shopping-bag"},

    # ── Finance Settings ──────────────────────────────────────────────────────
    {"type": "Section Break", "label": "Finance Settings",
        "icon": "credit-card",      "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Payment Gateway Account",
     "label": "Payment Gateway Account",           "child": 1, "icon": "credit-card"},
    {"type": "Link", "link_type": "DocType", "link_to": "Payment Terms Template",
     "label": "Payment Terms Template",            "child": 1, "icon": "file-text"},
    {"type": "Link", "link_type": "DocType", "link_to": "Mode of Payment",
     "label": "Mode of Payment",                   "child": 1, "icon": "banknote"},
    {"type": "Link", "link_type": "DocType", "link_to": "Bank",
     "label": "Bank",                              "child": 1, "icon": "landmark"},
    {"type": "Link", "link_type": "DocType", "link_to": "Bank Account",
     "label": "Bank Account",                      "child": 1, "icon": "wallet"},
    {"type": "Link", "link_type": "DocType", "link_to": "Bank Account Type",
     "label": "Bank Account Type",                 "child": 1, "icon": "list"},
    {"type": "Link", "link_type": "DocType", "link_to": "Bank Account Subtype",
     "label": "Bank Account Subtype",              "child": 1, "icon": "list"},
    {"type": "Link", "link_type": "DocType", "link_to": "Bank Transaction Mapping",
     "label": "Bank Transaction Mapping",          "child": 1, "icon": "table"},
    {"type": "Link", "link_type": "DocType", "link_to": "Purchase Taxes and Charges Template",
     "label": "Purchase Tax Templates",            "child": 1, "icon": "file-check"},
    {"type": "Link", "link_type": "DocType", "link_to": "Sales Taxes and Charges Template",
     "label": "Sales Tax Templates",               "child": 1, "icon": "file-check"},
    {"type": "Link", "link_type": "DocType", "link_to": "Item Tax Template",
     "label": "Item Tax Template",                 "child": 1, "icon": "tag"},

    # ── Customers Settings ────────────────────────────────────────────────────
    {"type": "Section Break", "label": "Customers Settings",
        "icon": "users",            "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Subscription Settings",
     "label": "Subscription Settings",         "child": 1, "icon": "calendar-clock"},
    {"type": "Link", "link_type": "DocType", "link_to": "Contract Template",
     "label": "Contract Template",             "child": 1, "icon": "file"},
    {"type": "Link", "link_type": "DocType", "link_to": "Appointment Booking Settings",
     "label": "Appointment Booking Settings",  "child": 1, "icon": "calendar-plus"},
    {"type": "Link", "link_type": "DocType", "link_to": "CRM Settings",
     "label": "CRM Settings",                  "child": 1, "icon": "users"},

    # ── Users ─────────────────────────────────────────────────────────────────
    {"type": "Section Break", "label": "Users",
        "icon": "user",             "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "User",
     "label": "User",              "child": 1, "icon": "user"},
    {"type": "Link", "link_type": "DocType", "link_to": "Role",
     "label": "Role",              "child": 1, "icon": "shield"},
    {"type": "Link", "link_type": "DocType", "link_to": "User Permission",
     "label": "User Permission",   "child": 1, "icon": "lock"},

    # ── General Settings ──────────────────────────────────────────────────────
    {"type": "Section Break", "label": "General Settings",
        "icon": "settings",         "child": 0, "indent": 1},
    {"type": "Link", "link_type": "DocType", "link_to": "Country",
     "label": "Country",               "child": 1, "icon": "globe"},
    {"type": "Link", "link_type": "DocType", "link_to": "Gender",
     "label": "Gender",                "child": 1, "icon": "user-check"},
    {"type": "Link", "link_type": "DocType", "link_to": "Address Template",
     "label": "Address Template",      "child": 1, "icon": "map"},
    {"type": "Link", "link_type": "DocType", "link_to": "Salutation",
     "label": "Salutation",            "child": 1, "icon": "user"},
    {"type": "Link", "link_type": "DocType", "link_to": "Authorization Rule",
     "label": "Authorization Rule",    "child": 1, "icon": "badge-check"},
    {"type": "Link", "link_type": "DocType", "link_to": "Global Defaults",
     "label": "Global Defaults",       "child": 1, "icon": "settings"},
    {"type": "Link", "link_type": "DocType", "link_to": "Party Type",
     "label": "Party Type",            "child": 1, "icon": "users"},
    {"type": "Link", "link_type": "DocType", "link_to": "Territory",
     "label": "Territory",             "child": 1, "icon": "map-pin"},
    {"type": "Link", "link_type": "DocType", "link_to": "Incoterm",
     "label": "Incoterm",              "child": 1, "icon": "package"},
    {"type": "Link", "link_type": "DocType", "link_to": "Terms and Conditions",
     "label": "Terms and Conditions",  "child": 1, "icon": "file-text"},
    {"type": "Link", "link_type": "DocType", "link_to": "Webhook",
     "label": "Webhook",               "child": 1, "icon": "webhook"},
    {"type": "Link", "link_type": "DocType", "link_to": "Module Profile",
     "label": "Module Profile",        "child": 1, "icon": "book"},
    {"type": "Link", "link_type": "DocType", "link_to": "Notification",
     "label": "Notification",          "child": 1, "icon": "bell"},

    # ── Connectors + Logs ─────────────────────────────────────────────────────
    # Both sections are built dynamically by setup/install.py:
    #   - Connectors: one Link per row in OS Connector Registry
    #   - Logs: connector apps' alaiy_os_sidebar_log_items hook entries
    # See _build_connector_sidebar_items() / _build_log_items(). Nothing
    # hard-coded here so newly installed connectors show up automatically.
]
