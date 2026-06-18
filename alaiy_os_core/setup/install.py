"""
AlaiyOS Core — provisioning logic.

Runs on after_install (fresh install) and after_migrate (every deploy).
Reconciles the site's workspace, branding and company to match this codebase.

Data definitions:
  constants/workspace.py   — WORKSPACE_NAME, shortcuts, links, sidebar items
  constants/branding.py    — logo / favicon asset paths
  constants/onboarding.py  — ONBOARDING_NAME, ONBOARDING_STEPS

Client config:
  client/config/boot_config.py    — COMPANY_NAME, COMPANY_CURRENCY, COMPANY_COUNTRY
"""

import hashlib
import json

import frappe

from alaiy_os_core.client.config import boot_config
from alaiy_os_core.constants import branding
from alaiy_os_core.constants.workspace import (
    WORKSPACE_NAME,
    WORKSPACE_SHORTCUTS,
    WORKSPACE_LINKS,
    WORKSPACE_SIDEBAR_ITEMS,
)
from alaiy_os_core.constants.onboarding import ONBOARDING_NAME, ONBOARDING_STEPS

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
    set_company_defaults()
    _cleanup_legacy_workspace()
    create_module_def()
    create_or_update_workspace()
    create_or_update_workspace_sidebar()
    create_or_update_onboarding()
    configure_branding()
    frappe.db.commit()
    frappe.clear_cache()


# ── Company defaults ──────────────────────────────────────────────────────────

def set_company_defaults():
    company_name = getattr(boot_config, "COMPANY_NAME", "").strip()
    if not company_name:
        return

    if not frappe.db.exists("Company", company_name):
        try:
            abbr = "".join(w[0].upper() for w in company_name.split()[
                           :3]) or company_name[:3].upper()
            frappe.get_doc({
                "doctype":          "Company",
                "company_name":     company_name,
                "abbr":             abbr,
                "default_currency": getattr(boot_config, "COMPANY_CURRENCY", "USD"),
                "country":          getattr(boot_config, "COMPANY_COUNTRY", "India"),
            }).insert(ignore_permissions=True)
        except Exception:
            frappe.log_error(
                title="AlaiyOS: could not create Company",
                message=frappe.get_traceback(),
            )

    frappe.db.set_single_value(
        "Global Defaults", "default_company", company_name)


# ── Module Def ────────────────────────────────────────────────────────────────

def create_module_def():
    if not frappe.db.exists("Module Def", MODULE_NAME):
        frappe.get_doc({
            "doctype":     "Module Def",
            "module_name": MODULE_NAME,
            "app_name":    "alaiy_os_core",
            "custom":      1,
        }).insert(ignore_permissions=True)
    else:
        frappe.db.set_value("Module Def", MODULE_NAME, {
            "app_name": "alaiy_os_core",
            "custom":   1,
        })


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


def _get_workspace_title():
    default_company = frappe.db.get_single_value(
        "Global Defaults", "default_company") or ""
    return (default_company + " OS") if default_company else WORKSPACE_NAME


def create_or_update_workspace():
    content = _build_workspace_content()
    title = _get_workspace_title()

    # Workspace is public — visible to all desk users without role restriction.
    # System Manager has full access by default.
    if not frappe.db.exists("Workspace", WORKSPACE_NAME):
        ws = frappe.get_doc({
            "doctype":   "Workspace",
            "label":     WORKSPACE_NAME,
            "title":     title,
            "name":      WORKSPACE_NAME,
            "type":      "Workspace",
            "public":    1,
            "icon":      "layout-dashboard",
            "module":    MODULE_NAME,
            "app":       "alaiy_os_core",
            "content":   content,
            "roles":     [],
            "shortcuts": WORKSPACE_SHORTCUTS,
            "links":     WORKSPACE_LINKS,
        })
        ws.insert(ignore_permissions=True)
    else:
        ws = frappe.get_doc("Workspace", WORKSPACE_NAME)
        ws.set("links", [])
        ws.set("shortcuts", [])
        for link in WORKSPACE_LINKS:
            ws.append("links", link)
        for shortcut in WORKSPACE_SHORTCUTS:
            ws.append("shortcuts", shortcut)
        ws.title = title
        ws.icon = "layout-dashboard"
        ws.module = MODULE_NAME
        ws.app = "alaiy_os_core"
        ws.type = "Workspace"
        ws.public = 1
        ws.content = content
        ws.roles = []
        ws.save(ignore_permissions=True)


# ── Workspace Sidebar ─────────────────────────────────────────────────────────

def create_or_update_workspace_sidebar():
    if frappe.db.exists("Workspace Sidebar", WORKSPACE_NAME):
        sidebar = frappe.get_doc("Workspace Sidebar", WORKSPACE_NAME)
        sidebar.for_user = ""
        sidebar.set("items", [])
        for item in WORKSPACE_SIDEBAR_ITEMS:
            sidebar.append("items", item)
        sidebar.save(ignore_permissions=True)
    else:
        sidebar = frappe.get_doc({
            "doctype":  "Workspace Sidebar",
            "name":     WORKSPACE_NAME,
            "title":    WORKSPACE_NAME,
            "for_user": "",
            "standard": 0,
            "app":      "alaiy_os_core",
            "items":    WORKSPACE_SIDEBAR_ITEMS,
        })
        sidebar.insert(ignore_permissions=True)


# ── Module Onboarding ─────────────────────────────────────────────────────────

def create_or_update_onboarding():
    enable = getattr(boot_config, "ENABLE_MODULE_ONBOARDING", False)

    if not enable:
        if frappe.db.exists("Workspace Sidebar", WORKSPACE_NAME):
            frappe.db.set_value("Workspace Sidebar", WORKSPACE_NAME,
                                "module_onboarding", None)
        return

    if not frappe.db.exists("Module Onboarding", ONBOARDING_NAME):
        doc = frappe.get_doc({
            "doctype":          "Module Onboarding",
            "name":             ONBOARDING_NAME,
            "title":            ONBOARDING_NAME,
            "subtitle":         "Get your workspace ready in a few steps.",
            "success_message":  "Great — your workspace is all set!",
            "documentation_url": "",
            "is_complete":      0,
            "steps":            [],
        })
        for step in ONBOARDING_STEPS:
            doc.append("steps", step)
        doc.insert(ignore_permissions=True)
    else:
        doc = frappe.get_doc("Module Onboarding", ONBOARDING_NAME)
        doc.set("steps", [])
        for step in ONBOARDING_STEPS:
            doc.append("steps", step)
        doc.save(ignore_permissions=True)

    if frappe.db.exists("Workspace Sidebar", WORKSPACE_NAME):
        frappe.db.set_value("Workspace Sidebar", WORKSPACE_NAME,
                            "module_onboarding", ONBOARDING_NAME)


# ── Branding ──────────────────────────────────────────────────────────────────

def configure_branding():
    def _safe_set(doctype, field, value):
        try:
            meta = frappe.get_meta(doctype)
            if meta.has_field(field):
                frappe.db.set_single_value(doctype, field, value)
        except Exception:
            frappe.log_error(
                title="AlaiyOS: configure_branding failed",
                message=frappe.get_traceback(),
            )

    _safe_set("Navbar Settings",  "app_logo",
              "/assets/alaiy_os_core/client/assets/client-logo-hor.png")
    _safe_set("Website Settings", "app_logo",
              "/assets/alaiy_os_core/client/assets/client-logo-hor.png")
    _safe_set("Website Settings", "banner_image",
              "/assets/alaiy_os_core/client/assets/client-logo-hor.png")
    _safe_set("Website Settings", "brand_html",
              f'<img src="/assets/alaiy_os_core/client/assets/client-logo-hor.png" alt="{boot_config.COMPANY_NAME} OS" style="height:32px">')
    _safe_set("Website Settings", "splash_image",
              "/assets/alaiy_os_core/client/assets/client-logo-square.png")
    _safe_set("System Settings",  "favicon",
              "/assets/alaiy_os_core/client/assets/client-icon.png")
    _safe_set("Website Settings", "favicon",
              "/assets/alaiy_os_core/client/assets/client-icon.png")
    _safe_set("System Settings",  "app_name",
              boot_config.COMPANY_NAME + " OS")
    _safe_set("Website Settings", "app_name",
              boot_config.COMPANY_NAME)
