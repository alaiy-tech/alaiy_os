import frappe
from alaiy_os_core.public.config.brand_config import VISIBLE_WORKSPACES, DEFAULT_ADMIN_PASSWORD
from alaiy_os_core.workspace.workspace_manager import patch_workspaces
from alaiy_os_core import branding
from alaiy_os_core.connectors.registry import setup_connectors


def after_install():
    """Fresh install: full setup + set admin password."""
    run_setup()
    _set_admin_password()


def after_migrate():
    """After `bench migrate`: re-apply setup (no password reset)."""
    run_setup()


def run_setup():
    """
    Idempotent deploy-time setup. Order matters:
      1. Hide non-visible workspaces (coarse, by name).
      2. Patch enabled workspaces' links/shortcuts to the config whitelist.
      3. Apply Alaiy branding (logo / app name / favicon) via settings docs.
      4. Apply remaining system settings.
    Safe to run repeatedly (after every `bench migrate`).
    """
    _hide_workspaces()
    patch_workspaces()
    branding.apply_branding()
    _apply_system_settings()
    setup_connectors()
    frappe.db.commit()
    frappe.clear_cache()


# ── Workspaces ────────────────────────────────────────────────

def _hide_workspaces():
    """Hide every workspace not listed in VISIBLE_WORKSPACES."""
    for ws in frappe.get_all("Workspace", fields=["name"]):
        hidden = 0 if ws["name"] in VISIBLE_WORKSPACES else 1
        frappe.db.set_value("Workspace", ws["name"], "is_hidden", hidden)


# ── System settings ───────────────────────────────────────────

def _apply_system_settings():
    """Disable modules / features not needed in AlaiyOS."""
    # Disable the Frappe Website module (public website builder)
    try:
        frappe.db.set_single_value("Website Settings", "disable_website", 1)
    except Exception:
        pass  # Website Settings may not exist on all installs


# ── Admin password ────────────────────────────────────────────

def _set_admin_password():
    """Set Administrator password from brand_config. Runs on after_install only."""
    from frappe.utils.password import update_password
    update_password("Administrator", DEFAULT_ADMIN_PASSWORD)
    frappe.db.commit()
