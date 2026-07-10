"""
Alaiy OS — provisioning logic.

Runs on after_install (fresh install) and after_migrate (every deploy).
Reconciles the site's workspace, branding and company to match this codebase.

Data definitions:
  constants/roles.py       — OS_MANAGER_ROLE
  constants/workspace.py   — WORKSPACE_NAME, shortcuts, links, sidebar items
  constants/onboarding.py  — ONBOARDING_NAME, ONBOARDING_STEPS
"""

import hashlib
import json
import os

import frappe

from alaiy_os.constants.roles import OS_MANAGER_ROLE
from alaiy_os.constants.workspace import (
    WORKSPACE_NAME,
    WORKSPACE_ROUTE,
    WORKSPACE_SHORTCUTS,
    WORKSPACE_LINKS,
    WORKSPACE_SIDEBAR_ITEMS,
)
from alaiy_os.constants.workspace_settings import (
    SETTINGS_WORKSPACE_NAME,
    SETTINGS_WORKSPACE_ROUTE,
    SETTINGS_WORKSPACE_LINKS,
    SETTINGS_WORKSPACE_SIDEBAR_ITEMS,
)
from alaiy_os.constants.onboarding import ONBOARDING_NAME, ONBOARDING_STEPS

MODULE_NAME = "Alaiy OS"


# ── Entry points ──────────────────────────────────────────────────────────────

def after_install():
    _run_provisioning()


def after_migrate():
    _run_provisioning()


def _cleanup_legacy_workspace():
    OLD_NAMES = ["Alaiy OS"]
    for old in OLD_NAMES:
        if frappe.db.exists("Workspace Sidebar", old):
            frappe.delete_doc("Workspace Sidebar", old,
                              ignore_permissions=True, force=True)
        if frappe.db.exists("Workspace", old):
            frappe.delete_doc("Workspace", old,
                              ignore_permissions=True, force=True)


def _run_provisioning():
    steps = [
        skip_erpnext_onboarding,
        _cleanup_legacy_workspace,
        create_module_def,
        create_or_update_role,
        delete_desktop_page,
        provision_shared_doctypes,
        create_or_update_workspace,
        create_or_update_workspace_sidebar,
        create_or_update_os_settings_workspace,
        create_or_update_os_settings_workspace_sidebar,
        restrict_foreign_workspaces,
        create_or_update_onboarding,
        ensure_default_logos,
        configure_system_settings,
        configure_navbar,
        configure_portal_settings,
    ]
    for step in steps:
        try:
            step()
        except Exception:
            frappe.log_error(
                title=f"Alaiy OS: provisioning step {step.__name__} failed",
                message=frappe.get_traceback(),
            )
    frappe.db.commit()
    frappe.clear_cache()


def skip_erpnext_onboarding():
    """
    Mark the ERPNext setup wizard as complete so it never pops up.
    Also marks all Module Onboarding records for ERPNext modules as complete
    so the Getting Started banners are suppressed.
    """
    frappe.db.set_default("setup_complete", 1)

    if frappe.db.exists("DocType", "System Settings"):
        try:
            meta = frappe.get_meta("System Settings")
            if meta.has_field("setup_complete"):
                frappe.db.set_single_value(
                    "System Settings", "setup_complete", 1)
        except Exception:
            pass

    for dt in ("Setup Progress", "ERPNext Settings"):
        if not frappe.db.exists("DocType", dt):
            continue
        try:
            meta = frappe.get_meta(dt)
            if meta.has_field("setup_complete"):
                frappe.db.set_single_value(dt, "setup_complete", 1)
        except Exception:
            pass

    for name in frappe.get_all("Module Onboarding", pluck="name"):
        if name == ONBOARDING_NAME:
            continue
        try:
            frappe.db.set_value("Module Onboarding", name, "is_complete", 1)
        except Exception:
            pass

    if frappe.db.exists("DocType", "User") and frappe.db.has_column("User", "onboarding_status"):
        frappe.db.sql(
            "UPDATE tabUser SET onboarding_status = 'Skipped' WHERE onboarding_status IS NULL OR onboarding_status = ''")


# ── Role ─────────────────────────────────────────────────────────────────────

def create_or_update_role():
    """Create the OS Manager role as a standard role with the OS home page."""
    role_data = {
        "is_standard": 1,
        "desk_access": 1,
        "home_page":   "/desk/os",
    }
    if not frappe.db.exists("Role", OS_MANAGER_ROLE):
        frappe.get_doc({
            "doctype":   "Role",
            "role_name": OS_MANAGER_ROLE,
            **role_data,
        }).insert(ignore_permissions=True)
    else:
        frappe.db.set_value("Role", OS_MANAGER_ROLE, role_data)


# ── Desktop page removal ───────────────────────────────────────────────────────

def delete_desktop_page():
    """
    Delete the stock Frappe "desktop" Page outright. /desk itself keeps
    landing on the OS workspace regardless (see setup/boot.py::on_login),
    this just removes the old default-desktop route entirely.
    """
    if not frappe.db.exists("Page", "desktop"):
        return
    # Page.on_trash() throws outside developer mode unless this flag is set —
    # Frappe core's own drop_unused_pages patch relies on the same toggle.
    frappe.flags.in_migrate = True
    try:
        frappe.delete_doc("Page", "desktop", ignore_permissions=True, force=True)
    finally:
        frappe.flags.in_migrate = False


# ── Foreign workspace restriction ───────────────────────────────────────────────

def _delete_welcome_workspace():
    """Hard-delete the stock "Welcome Workspace" (and its sidebar row, if
    any) — unlike every other foreign workspace, this one is removed
    outright rather than just hidden."""
    if frappe.db.exists("Workspace Sidebar", "Welcome Workspace"):
        frappe.delete_doc("Workspace Sidebar", "Welcome Workspace",
                           ignore_permissions=True, force=True)
    if frappe.db.exists("Workspace", "Welcome Workspace"):
        frappe.delete_doc("Workspace", "Welcome Workspace",
                           ignore_permissions=True, force=True)


def restrict_foreign_workspaces():
    """
    Hide every public Workspace not owned by alaiy_os (ERPNext's and
    Frappe's own Stock/Selling/Buying/HR/etc. workspaces) from the workspace
    switcher, Awesomebar search and desktop icons, and lock them to
    Administrator only. "Welcome Workspace" specifically is hard-deleted
    instead (see _delete_welcome_workspace()), not just hidden.

    Re-runs on every after_migrate so new workspaces introduced by future
    app/ERPNext updates get caught too. Our own workspaces (OS, OS Settings)
    are left untouched.
    """
    _delete_welcome_workspace()

    own_names = {WORKSPACE_NAME, SETTINGS_WORKSPACE_NAME}
    rows = frappe.get_all(
        "Workspace",
        filters={"public": 1},
        fields=["name", "app"],
    )
    for row in rows:
        if row.name in own_names or row.app == "alaiy_os" or row.name == "Welcome Workspace":
            continue
        try:
            doc = frappe.get_doc("Workspace", row.name)
            doc.is_hidden = 1
            doc.set("roles", [{"role": "Administrator"}])
            doc.flags.ignore_validate = True
            doc.flags.ignore_links = True
            # Some stock ERPNext/Frappe workspaces (e.g. "Welcome Workspace")
            # ship with legacy/partial records missing newer mandatory
            # fields (e.g. `type`). We're only touching is_hidden/roles here,
            # not fixing their data — ignore_mandatory keeps that out of scope.
            doc.flags.ignore_mandatory = True
            doc.save(ignore_permissions=True)
        except Exception:
            frappe.log_error(
                title=f"Alaiy OS: could not restrict workspace {row.name!r}",
                message=frappe.get_traceback(),
            )


# ── Default logos ──────────────────────────────────────────────────────────────

def ensure_default_logos():
    """
    Copy this app's bundled default logos into the site's shared (non-app-
    namespaced) assets folder as client-logo-square.png / client-logo-hor.png
    — only if those files don't already exist, so a fresh install gets sane
    defaults immediately without ever clobbering an admin's own upload made
    later via the OS Theme Settings page (alaiy_os/alaiy_os/doctype/os_theme_settings).
    """
    import shutil

    images_dir = os.path.join(frappe.local.sites_path, "assets", "images")
    os.makedirs(images_dir, exist_ok=True)

    pairs = [
        ("logo-square.png", "client-logo-square.png"),
        ("logo-hor.png", "client-logo-hor.png"),
    ]
    for source_name, dest_name in pairs:
        dest_path = os.path.join(images_dir, dest_name)
        if os.path.exists(dest_path):
            continue
        source_path = frappe.get_app_path("alaiy_os", "public", "images", source_name)
        if os.path.exists(source_path):
            shutil.copyfile(source_path, dest_path)


# ── System Settings ────────────────────────────────────────────────────────────

def configure_system_settings():
    frappe.db.set_single_value("System Settings", "disable_system_update_notification", 1)


# ── Navbar Settings ─────────────────────────────────────────────────────────────

def configure_navbar():
    """
    Point the navbar logo at the site's client-hor-logo, clear the Settings
    dropdown entirely, and reset the Help dropdown to exactly two items
    (About Alaiy OS, Keyboard Shortcuts) — dropping the stock System
    Health / Frappe Support entries by simply not re-adding them.
    """
    navbar = frappe.get_single("Navbar Settings")
    navbar.app_logo = "/assets/images/client-logo-hor.png"
    navbar.set("settings_dropdown", [])
    navbar.set("help_dropdown", [])
    navbar.append("help_dropdown", {
        "item_label": "About Alaiy OS",
        "item_type": "Route",
        "route": "https://os.alaiy.com",
    })
    navbar.append("help_dropdown", {
        "item_label": "Keyboard Shortcuts",
        "item_type": "Action",
        "action": "frappe.ui.toolbar.show_shortcuts(event)",
    })
    navbar.flags.ignore_mandatory = True
    navbar.save(ignore_permissions=True)


# ── Portal Settings ─────────────────────────────────────────────────────────────

def configure_portal_settings():
    frappe.db.set_single_value("Portal Settings", "default_portal_home", "/desk/os")


# ── Shared Generic DocTypes ───────────────────────────────────────────────────

def provision_shared_doctypes():
    """
    Create shared generic DocTypes used by all connector types.
    Idempotent — skips creation if each DocType already exists.
    """
    _create_item_supplier_attribute()
    _create_supplier_item_availability()
    _create_channel_listing()
    frappe.db.commit()


def _shared_permissions():
    return [{"role": "System Manager", "read": 1, "write": 1, "create": 1, "delete": 1}]


def _create_item_supplier_attribute():
    if frappe.db.exists("DocType", "Item Supplier Attribute"):
        return
    frappe.get_doc({
        "doctype": "DocType",
        "name": "Item Supplier Attribute",
        "module": MODULE_NAME,
        "custom": 1,
        "istable": 1,
        "editable_grid": 1,
        "fields": [
            {"fieldname": "supplier", "fieldtype": "Link", "options": "Supplier",
             "label": "Supplier", "in_list_view": 1},
            {"fieldname": "connector_name", "fieldtype": "Data",
             "label": "Connector", "in_list_view": 1},
            {"fieldname": "attribute_key", "fieldtype": "Data",
             "label": "Key", "in_list_view": 1},
            {"fieldname": "attribute_value",
                "fieldtype": "Small Text", "label": "Value"},
        ],
        "permissions": _shared_permissions(),
    }).insert(ignore_permissions=True)
    if not frappe.db.exists("Custom Field", "Item-supplier_attributes"):
        frappe.get_doc({
            "doctype": "Custom Field",
            "dt": "Item",
            "fieldname": "supplier_attributes",
            "label": "Supplier Attributes",
            "fieldtype": "Table",
            "options": "Item Supplier Attribute",
            "insert_after": "description",
        }).insert(ignore_permissions=True)


def _create_supplier_item_availability():
    if frappe.db.exists("DocType", "Supplier Item Availability"):
        return
    frappe.get_doc({
        "doctype": "DocType",
        "name": "Supplier Item Availability",
        "module": MODULE_NAME,
        "custom": 1,
        "fields": [
            {"fieldname": "item_code", "fieldtype": "Link", "options": "Item",
             "label": "Item Code", "reqd": 1, "in_list_view": 1},
            {"fieldname": "supplier", "fieldtype": "Link", "options": "Supplier",
             "label": "Supplier", "reqd": 1, "in_list_view": 1},
            {"fieldname": "connector_name", "fieldtype": "Data",
             "label": "Connector", "in_list_view": 1},
            {"fieldname": "available_qty", "fieldtype": "Float",
             "label": "Available Qty", "in_list_view": 1},
            {"fieldname": "warehouse", "fieldtype": "Link", "options": "Warehouse",
             "label": "Warehouse"},
            {"fieldname": "last_updated", "fieldtype": "Datetime",
             "label": "Last Updated", "read_only": 1},
        ],
        "permissions": _shared_permissions(),
    }).insert(ignore_permissions=True)


def _create_channel_listing():
    if frappe.db.exists("DocType", "Channel Listing"):
        return
    frappe.get_doc({
        "doctype": "DocType",
        "name": "Channel Listing",
        "module": MODULE_NAME,
        "custom": 1,
        "istable": 1,
        "editable_grid": 1,
        "fields": [
            {"fieldname": "connector_name", "fieldtype": "Data",
             "label": "Connector", "in_list_view": 1},
            {"fieldname": "channel", "fieldtype": "Data",
             "label": "Channel", "in_list_view": 1},
            {"fieldname": "listed", "fieldtype": "Check",
             "label": "Listed", "default": "0"},
            {"fieldname": "external_product_id", "fieldtype": "Data",
             "label": "External Product ID"},
            {"fieldname": "external_variant_id", "fieldtype": "Data",
             "label": "External Variant ID"},
            {"fieldname": "channel_url", "fieldtype": "Data", "label": "Channel URL"},
            {"fieldname": "last_pushed_at", "fieldtype": "Datetime",
             "label": "Last Pushed At", "read_only": 1},
        ],
        "permissions": _shared_permissions(),
    }).insert(ignore_permissions=True)
    if not frappe.db.exists("Custom Field", "Item-channel_listings"):
        frappe.get_doc({
            "doctype": "Custom Field",
            "dt": "Item",
            "fieldname": "channel_listings",
            "label": "Channel Listings",
            "fieldtype": "Table",
            "options": "Channel Listing",
            "insert_after": "supplier_attributes",
        }).insert(ignore_permissions=True)


# ── Module Def ────────────────────────────────────────────────────────────────

def create_module_def():
    if not frappe.db.exists("Module Def", MODULE_NAME):
        frappe.get_doc({
            "doctype":     "Module Def",
            "module_name": MODULE_NAME,
            "app_name":    "alaiy_os",
            "custom":      1,
        }).insert(ignore_permissions=True)
    else:
        frappe.db.set_value("Module Def", MODULE_NAME, {
            "app_name": "alaiy_os",
            "custom":   1,
        })


# ── Workspace naming ──────────────────────────────────────────────────────────
#
# Frappe's URL for a Workspace is slug(Workspace.name) — there is no separate
# "route" field (an earlier version of this file assumed there was one; there
# isn't, so WORKSPACE_NAME/SETTINGS_WORKSPACE_NAME must stay exactly "OS" and
# "OS Settings" forever, or /desk/os and /desk/os-settings break). Workspace's
# own autoname is "field:label" — changing `label` on an existing doc renames
# it out from under WORKSPACE_NAME (this bit us once already), so `label`
# must ALSO stay fixed, same as `name`. Frappe also looks up a workspace's
# sidebar via frappe.boot.workspace_sidebar_item[Workspace.name.lower()] —
# keyed by name, not title — so the Workspace Sidebar's name must equal the
# Workspace's name too, which (since Workspace Sidebar autonames from its own
# title field) means the sidebar's title must also stay "OS"/"OS Settings".
#
# Company branding can ONLY be applied to Workspace.title — the one field
# that's genuinely independent of both docs' identity. In practice this means
# it doesn't reach the sidebar header dropdown or the page breadcrumb (both
# hardcoded by Frappe to Workspace.name specifically), only wherever else
# `.title` happens to be read.

def _get_default_company():
    company = (frappe.db.get_single_value(
        "Global Defaults", "default_company") or "").strip()
    if company:
        return company


def _get_os_workspace_title():
    company = _get_default_company()
    return f"{company} OS" if company else WORKSPACE_NAME


def _get_os_settings_workspace_title():
    company = _get_default_company()
    return f"{company} OS Settings" if company else SETTINGS_WORKSPACE_NAME


def _connector_registry_rows():
    if not frappe.db.exists("DocType", "OS Connector Registry"):
        return []
    rows = frappe.get_all(
        "OS Connector Registry",
        fields=["connector_id", "connector_name", "settings_doctype", "icon"],
        order_by="connector_name asc",
    )
    return [r for r in rows if r.get("settings_doctype")]


def _build_connector_workspace_links():
    """Connectors card on the OS Settings workspace body: one Link per
    installed connector, pointing at its settings DocType."""
    rows = [r for r in _connector_registry_rows()
            if frappe.db.exists("DocType", r.settings_doctype)]
    if not rows:
        return []
    links = [{"type": "Card Break", "label": "Connectors", "icon": "plug"}]
    for row in rows:
        links.append({
            "type": "Link", "link_type": "DocType",
            "link_to": row.settings_doctype, "label": row.connector_name,
        })
    return links


def _build_connector_sidebar_items():
    """Connectors section in the OS Settings sidebar: one Link per installed
    connector, pointing at its settings DocType."""
    rows = [r for r in _connector_registry_rows()
            if frappe.db.exists("DocType", r.settings_doctype)]
    if not rows:
        return []
    items = [{"type": "Section Break", "label": "Connectors",
              "icon": "plug", "child": 0, "indent": 1}]
    for row in rows:
        items.append({
            "type": "Link", "link_type": "DocType", "link_to": row.settings_doctype,
            "label": row.connector_name, "child": 1, "icon": row.icon or "plug",
        })
    return items


def _build_log_items():
    """
    Logs section in the OS Settings sidebar. Connector apps register their
    log links via the alaiy_os_sidebar_log_items hook:

        alaiy_os_sidebar_log_items = [
            {"link_type": "DocType", "link_to": "Cloudstore Sync Log",
             "label": "Cloudstore Logs", "icon": "activity"}
        ]

    Items whose target DocType/Page hasn't been installed yet are skipped.
    """
    entries = []
    for hook_entries in frappe.get_hooks("alaiy_os_sidebar_log_items"):
        for entry in (hook_entries if isinstance(hook_entries, list) else [hook_entries]):
            link_type = entry.get("link_type", "DocType")
            link_to = (entry.get("link_to") or "").strip()
            if not link_to:
                continue
            if link_type == "DocType" and not frappe.db.exists("DocType", link_to):
                continue
            if link_type == "Page" and not frappe.db.exists("Page", link_to):
                continue
            entries.append({
                "type":      "Link",
                "link_type": link_type,
                "link_to":   link_to,
                "label":     entry.get("label", link_to),
                "child":     1,
                "icon":      entry.get("icon", "activity"),
            })
    if not entries:
        return []
    return [{"type": "Section Break", "label": "Logs",
             "icon": "file-clock", "child": 0, "indent": 1}] + entries


# ── Workspace ─────────────────────────────────────────────────────────────────

def _block_id(label):
    return hashlib.md5(f"alaiy-block-{label}".encode()).hexdigest()[:10]


def _build_workspace_content():
    blocks = []
    for s in WORKSPACE_SHORTCUTS:
        blocks.append({
            "id":   _block_id(f"sc:{s['label']}"),
            "type": "shortcut",
            "data": {"shortcut_name": s["label"], "col": 3},
        })
    for link in WORKSPACE_LINKS:
        if link.get("type") == "Card Break":
            blocks.append({
                "id":   _block_id(f"card:{link['label']}"),
                "type": "card",
                "data": {"card_name": link["label"], "col": 4},
            })
    return json.dumps(blocks)


def create_or_update_workspace():
    content = _build_workspace_content()
    title = _get_os_workspace_title()

    if not frappe.db.exists("Workspace", WORKSPACE_NAME):
        ws = frappe.get_doc({
            "doctype":   "Workspace",
            # label is Workspace's autoname source (autoname="field:label") —
            # it MUST stay WORKSPACE_NAME, exactly like name, or Frappe
            # renames the doc out from under WORKSPACE_NAME on every save.
            "label":     WORKSPACE_NAME,
            "title":     title,
            "name":      WORKSPACE_NAME,
            "type":      "Workspace",
            "public":    1,
            "icon":      "layout-dashboard",
            "module":    MODULE_NAME,
            "app":       "alaiy_os",
            "content":   content,
            "roles":     [],
            "shortcuts": WORKSPACE_SHORTCUTS,
            "links":     WORKSPACE_LINKS,
        })
        ws.flags.ignore_validate = True
        ws.insert(ignore_permissions=True)
    else:
        ws = frappe.get_doc("Workspace", WORKSPACE_NAME)
        ws.set("links", [])
        ws.set("shortcuts", [])
        for link in WORKSPACE_LINKS:
            ws.append("links", link)
        for shortcut in WORKSPACE_SHORTCUTS:
            ws.append("shortcuts", shortcut)
        ws.label = WORKSPACE_NAME
        ws.title = title
        ws.icon = "layout-dashboard"
        ws.module = MODULE_NAME
        ws.app = "alaiy_os"
        ws.type = "Workspace"
        ws.public = 1
        ws.content = content
        ws.roles = []
        ws.flags.ignore_validate = True
        ws.save(ignore_permissions=True)


# ── Workspace Sidebar ─────────────────────────────────────────────────────────

def create_or_update_workspace_sidebar():
    items = list(WORKSPACE_SIDEBAR_ITEMS)
    # Title must stay == WORKSPACE_NAME: Workspace Sidebar autonames from
    # title, and that name must match the Workspace's own (fixed) name for
    # Frappe's client-side sidebar lookup to find it.
    common_fields = {
        "title":             WORKSPACE_NAME,
        "for_user":          "",
        "standard":          1,
        "app":               "alaiy_os",
        "module_onboarding": ONBOARDING_NAME,
    }

    if frappe.db.exists("Workspace Sidebar", WORKSPACE_NAME):
        sidebar = frappe.get_doc("Workspace Sidebar", WORKSPACE_NAME)
        for k, v in common_fields.items():
            sidebar.set(k, v)
        sidebar.set("items", [])
        for item in items:
            sidebar.append("items", item)
        sidebar.flags.ignore_links = True
        sidebar.save(ignore_permissions=True)
    else:
        sidebar = frappe.get_doc({
            "doctype": "Workspace Sidebar",
            **common_fields,
            "items":   items,
        })
        sidebar.flags.ignore_links = True
        sidebar.insert(ignore_permissions=True)


# ── OS Settings Workspace ─────────────────────────────────────────────────────

def _build_os_settings_content():
    blocks = []
    links = list(SETTINGS_WORKSPACE_LINKS) + _build_connector_workspace_links()
    for link in links:
        if link.get("type") == "Card Break":
            blocks.append({
                "id":   _block_id(f"settings-card:{link['label']}"),
                "type": "card",
                "data": {"card_name": link["label"], "col": 4},
            })
    return json.dumps(blocks)


def create_or_update_os_settings_workspace():
    content = _build_os_settings_content()
    title = _get_os_settings_workspace_title()
    links = list(SETTINGS_WORKSPACE_LINKS) + _build_connector_workspace_links()

    if not frappe.db.exists("Workspace", SETTINGS_WORKSPACE_NAME):
        ws = frappe.get_doc({
            "doctype": "Workspace",
            # label is Workspace's autoname source — must stay
            # SETTINGS_WORKSPACE_NAME, see create_or_update_workspace().
            "label":   SETTINGS_WORKSPACE_NAME,
            "title":   title,
            "name":    SETTINGS_WORKSPACE_NAME,
            "type":    "Workspace",
            "public":  1,
            "icon":    "settings",
            "module":  MODULE_NAME,
            "app":     "alaiy_os",
            "content": content,
            "roles":   [],
            "shortcuts": [],
            "links":   links,
        })
        ws.flags.ignore_validate = True
        ws.insert(ignore_permissions=True)
    else:
        ws = frappe.get_doc("Workspace", SETTINGS_WORKSPACE_NAME)
        ws.set("links", [])
        ws.set("shortcuts", [])
        for link in links:
            ws.append("links", link)
        ws.label = SETTINGS_WORKSPACE_NAME
        ws.title = title
        ws.icon = "settings"
        ws.module = MODULE_NAME
        ws.app = "alaiy_os"
        ws.type = "Workspace"
        ws.public = 1
        ws.content = content
        ws.roles = []
        ws.flags.ignore_validate = True
        ws.save(ignore_permissions=True)


def create_or_update_os_settings_workspace_sidebar():
    items = list(SETTINGS_WORKSPACE_SIDEBAR_ITEMS)
    items += _build_connector_sidebar_items()
    items += _build_log_items()

    # Title must stay == SETTINGS_WORKSPACE_NAME — see create_or_update_workspace_sidebar().
    common_fields = {
        "title":             SETTINGS_WORKSPACE_NAME,
        "for_user":          "",
        "standard":          1,
        "app":               "alaiy_os",
        "module_onboarding": None,
    }

    if frappe.db.exists("Workspace Sidebar", SETTINGS_WORKSPACE_NAME):
        sidebar = frappe.get_doc("Workspace Sidebar", SETTINGS_WORKSPACE_NAME)
        for k, v in common_fields.items():
            sidebar.set(k, v)
        sidebar.set("items", [])
        for item in items:
            sidebar.append("items", item)
        sidebar.flags.ignore_links = True
        sidebar.save(ignore_permissions=True)
    else:
        sidebar = frappe.get_doc({
            "doctype": "Workspace Sidebar",
            **common_fields,
            "items":   items,
        })
        sidebar.flags.ignore_links = True
        sidebar.insert(ignore_permissions=True)


# ── Module Onboarding ─────────────────────────────────────────────────────────

def _create_or_update_onboarding_steps():
    """
    Create or update standalone Onboarding Step records.
    Returns a list of step names for referencing from Module Onboarding.
    """
    step_names = []
    for step_def in ONBOARDING_STEPS:
        step_name = step_def["name"]
        fields = {k: v for k, v in step_def.items() if k != "name"}
        if not frappe.db.exists("Onboarding Step", step_name):
            try:
                frappe.get_doc({
                    "doctype": "Onboarding Step",
                    "name":    step_name,
                    **fields,
                }).insert(ignore_permissions=True)
            except Exception:
                frappe.log_error(
                    title=f"Alaiy OS: could not create Onboarding Step {step_name!r}",
                    message=frappe.get_traceback(),
                )
        else:
            frappe.db.set_value("Onboarding Step", step_name, fields)
        step_names.append(step_name)
    return step_names


def create_or_update_onboarding():
    """
    Always create/update the Module Onboarding record and its Onboarding Steps.
    """
    step_names = _create_or_update_onboarding_steps()

    onboarding_doc = {
        "title":           "Get Started with Alaiy OS",
        "subtitle":        "Get your workspace ready in a few steps.",
        "success_message": "Great — your workspace is all set!",
        "documentation_url": "",
        "is_complete":     0,
        "module":          MODULE_NAME,
    }

    if not frappe.db.exists("Module Onboarding", ONBOARDING_NAME):
        doc = frappe.get_doc({
            "doctype": "Module Onboarding",
            "name":    ONBOARDING_NAME,
            **onboarding_doc,
            "steps":   [],
        })
        for name in step_names:
            doc.append("steps", {"step": name})
        # allow_roles is a child table; set it if the field exists on this Frappe version
        try:
            doc.set("allow_roles", [{"role": OS_MANAGER_ROLE}])
        except Exception:
            pass
        doc.flags.ignore_validate = True
        doc.insert(ignore_permissions=True)
    else:
        doc = frappe.get_doc("Module Onboarding", ONBOARDING_NAME)
        for k, v in onboarding_doc.items():
            doc.set(k, v)
        doc.set("steps", [])
        for name in step_names:
            doc.append("steps", {"step": name})
        try:
            doc.set("allow_roles", [{"role": OS_MANAGER_ROLE}])
        except Exception:
            pass
        doc.flags.ignore_validate = True
        doc.save(ignore_permissions=True)

    # Link or unlink from sidebar based on config flag
    if frappe.db.exists("Workspace Sidebar", WORKSPACE_NAME):
        frappe.db.set_value(
            "Workspace Sidebar", WORKSPACE_NAME,
            "module_onboarding", ONBOARDING_NAME
        )
