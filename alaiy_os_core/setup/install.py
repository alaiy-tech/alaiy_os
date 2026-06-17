"""
AlaiyOS Core — provisioning logic.

This module is the single source of truth for the AlaiyOS environment. It runs
on `after_install` (fresh install) and `after_migrate` (every deploy), and
reconciles the live ERPNext site to match the definitions in this file.

Idempotency contract:
  * Roles                          create / skip if exists
  * User                           create + set password / reconcile roles only
  * Workspace                      create / overwrite links + shortcuts
  * DocType permissions            add new, remove stale (two-way diff)
  * Standard workspace restrictions strip AlaiyOS roles (idempotent)
  * Login redirect                 set home_page (idempotent)

The app code is authoritative — manual edits made in the ERPNext UI to the
Alaiy OS workspace links/shortcuts or to the reconciled permissions are
overwritten on the next `bench migrate`.
"""

import frappe
import frappe.utils.password

from alaiy_os_core.client.config import boot_config


# ── Config loading (MUST FAIL LOUDLY) ─────────────────────────────────────────

def _load_config():
    required = ["ALAIY_OS_ADMIN_USERNAME",
                "ALAIY_OS_ADMIN_EMAIL", "ALAIY_OS_ADMIN_PASSWORD"]
    missing = [k for k in required if not getattr(boot_config, k, None)]
    if missing:
        raise frappe.ValidationError(
            f"[AlaiyOS] Installation aborted. Missing required fields in "
            f"boot_config.py: {missing}. "
            f"Please configure alaiy_os_core/client/config/boot_config.py before installing."
        )
    return {k: getattr(boot_config, k) for k in required}


# ── Entry points ──────────────────────────────────────────────────────────────

def after_install():
    _run_provisioning()


def after_migrate():
    _run_provisioning()


def _run_provisioning():
    config = _load_config()
    create_roles()
    create_or_update_user(config)
    create_or_update_workspace()
    reconcile_doctype_permissions()
    restrict_standard_workspaces()
    configure_login_redirect(config)
    frappe.db.commit()
    frappe.clear_cache()


# ── Roles ─────────────────────────────────────────────────────────────────────

ROLES = ["Alaiy OS Manager", "Alaiy OS User"]


def create_roles():
    for role_name in ROLES:
        if not frappe.db.exists("Role", role_name):
            frappe.get_doc({
                "doctype": "Role",
                "role_name": role_name,
                "desk_access": 1
            }).insert(ignore_permissions=True)


# ── User ──────────────────────────────────────────────────────────────────────

def create_or_update_user(config):
    email = config["ALAIY_OS_ADMIN_EMAIL"]
    username = config["ALAIY_OS_ADMIN_USERNAME"]
    password = config["ALAIY_OS_ADMIN_PASSWORD"]

    if not frappe.db.exists("User", email):
        user = frappe.get_doc({
            "doctype": "User",
            "email": email,
            "username": username,
            "first_name": "AlaiyOS",
            "last_name": "Admin",
            "send_welcome_email": 0,
            "user_type": "System User",
            "roles": [{"role": r} for r in ROLES]
        })
        user.insert(ignore_permissions=True)
        frappe.utils.password.update_password(email, password)
    else:
        user = frappe.get_doc("User", email)
        existing_roles = {r.role for r in user.roles}
        changed = False
        for role_name in ROLES:
            if role_name not in existing_roles:
                user.append("roles", {"role": role_name})
                changed = True
        if changed:
            user.save(ignore_permissions=True)


# ── Workspace ───────────────────────────────────────────────────────────────

WORKSPACE_NAME = "Alaiy OS"
LOGO_URL = "/assets/alaiy_os_core/images/logo-square.png"

# The dummy entries (Ask AlaiyOS, Dashboard, My Pinned, Reports & Analytics,
# Settings) all point to "Stock Entry" as a placeholder so Frappe renders them
# without throwing a missing-doctype error. They will be replaced with real
# targets in the next iteration. Do not add click handlers or special behaviour.
WORKSPACE_SHORTCUTS = [
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "Ask AlaiyOS", "color": "purple"},
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "Dashboard",   "color": "blue"},
    {"type": "DocType", "link_to": "Stock Entry",
        "label": "My Pinned",   "color": "green"},
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
    {"type": "Link", "link_type": "DocType",
        "link_to": "Stock Entry", "label": "Settings"},
]


def create_or_update_workspace():
    if not frappe.db.exists("Workspace", WORKSPACE_NAME):
        ws = frappe.get_doc({
            "doctype": "Workspace",
            "label": WORKSPACE_NAME,
            "title": WORKSPACE_NAME,
            "name": WORKSPACE_NAME,
            "is_standard": 1,
            "public": 1,
            "icon": LOGO_URL,
            "category": "Modules",
            "roles": [{"role": r} for r in ROLES],
            "shortcuts": WORKSPACE_SHORTCUTS,
            "links": WORKSPACE_LINKS,
        })
        ws.insert(ignore_permissions=True)
    else:
        ws = frappe.get_doc("Workspace", WORKSPACE_NAME)

        # Always overwrite links and shortcuts — app code is source of truth
        ws.set("links", [])
        ws.set("shortcuts", [])
        for link in WORKSPACE_LINKS:
            ws.append("links", link)
        for shortcut in WORKSPACE_SHORTCUTS:
            ws.append("shortcuts", shortcut)

        # Ensure icon stays set
        ws.icon = LOGO_URL

        # Ensure roles are present
        existing_roles = {r.role for r in ws.roles}
        for role_name in ROLES:
            if role_name not in existing_roles:
                ws.append("roles", {"role": role_name})

        ws.save(ignore_permissions=True)


# ── DocType permissions — full reconciliation ─────────────────────────────────

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

PERMISSION_MAP = {
    "read": 1, "write": 1, "create": 1, "delete": 0,
    "submit": 1, "cancel": 1, "amend": 1,
    "report": 1, "export": 1, "import": 0,
    "print": 1, "email": 1,
}


def reconcile_doctype_permissions():
    for role in ROLES:
        existing_records = frappe.get_all(
            "Custom DocPerm",
            filters={"role": role},
            fields=["name", "parent"]
        )
        existing_doctypes = {r.parent for r in existing_records}
        desired_doctypes = set(TARGET_DOCTYPES)

        # Add permissions for new DocTypes
        for dt in desired_doctypes - existing_doctypes:
            if frappe.db.exists("DocType", dt):
                frappe.get_doc({
                    "doctype": "Custom DocPerm",
                    "parent": dt,
                    "parenttype": "DocType",
                    "parentfield": "permissions",
                    "role": role,
                    **PERMISSION_MAP
                }).insert(ignore_permissions=True)

        # Remove permissions for DocTypes no longer in the list
        for dt in existing_doctypes - desired_doctypes:
            stale = frappe.get_all(
                "Custom DocPerm",
                filters={"parent": dt, "role": role},
                fields=["name"]
            )
            for record in stale:
                frappe.delete_doc(
                    "Custom DocPerm", record.name,
                    ignore_permissions=True, force=True
                )


# ── Restrict standard workspaces ──────────────────────────────────────────────

STANDARD_WORKSPACES_TO_HIDE = [
    "Stock", "Selling", "Buying", "Accounting", "HR", "CRM",
    "Manufacturing", "Projects", "Assets", "Quality", "Support",
    "Payroll", "ERPNext Integrations", "Settings", "Users",
    "Build", "Home", "Learn", "Website", "Customization"
]


def restrict_standard_workspaces():
    for ws_name in STANDARD_WORKSPACES_TO_HIDE:
        if not frappe.db.exists("Workspace", ws_name):
            continue
        ws = frappe.get_doc("Workspace", ws_name)
        original_count = len(ws.roles)
        ws.roles = [r for r in ws.roles if r.role not in set(ROLES)]
        if len(ws.roles) != original_count:
            ws.save(ignore_permissions=True)


# ── Login redirect ─────────────────────────────────────────────────────────

def configure_login_redirect(config):
    email = config["ALAIY_OS_ADMIN_EMAIL"]
    if frappe.db.exists("User", email):
        frappe.db.set_value("User", email, "home_page", "/app/alaiy-os")
