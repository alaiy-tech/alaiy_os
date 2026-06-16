"""
AlaiyOS Core — bootinfo injection.

Two boot hooks run on every Desk page load (wired in hooks.py under
`extend_bootinfo`):

  1. extend_bootinfo                  — brand/feature flags for the JS layer.
  2. inject_branding_and_restrictions — branding URLs + the per-user blocked list
                                        consumed by route_guard.js.

Injecting the blocked list into frappe.boot means the JS route guard needs NO
extra API round-trip — it reads frappe.boot.blocked_doctypes directly.
"""

import frappe

from alaiy_os_core.public.config import brand_config as cfg
from alaiy_os_core.config.workspace_config import get_blocked_doctypes
from alaiy_os_core.permissions import is_system_admin
from alaiy_os_core import branding


def extend_bootinfo(bootinfo):
    """Inject AlaiyOS feature flags into frappe.boot so the JS layer reads them."""
    bootinfo.alaiy_config = frappe._dict(
        hide_desktop_option=cfg.HIDE_DESKTOP_OPTION,
        redirect_home_to_workspace=cfg.REDIRECT_HOME_TO_WORKSPACE,
        custom_theme=cfg.CUSTOM_THEME,
        toggle_default_theme=cfg.TOGGLE_DEFAULT_THEME,
        visible_workspaces=cfg.VISIBLE_WORKSPACES,
    )


def inject_branding_and_restrictions(bootinfo):
    """
    Inject branding + the per-user blocked-DocType list into frappe.boot.

    * Branding (logo + app name) is injected for ALL users so the navbar is
      consistently Alaiy-branded.
    * blocked_doctypes is injected ONLY for non-System-Administrators. Admins get
      an empty list, so the route guard never blocks them.
    """
    # Branding — available to every session for the JS/navbar layer.
    bootinfo.app_logo_url = branding.LOGO_URL
    bootinfo.app_name = branding.APP_NAME

    # Restrictions — role-scoped. Admins see everything, so no block list.
    if is_system_admin(frappe.session.user):
        bootinfo.blocked_doctypes = []
    else:
        bootinfo.blocked_doctypes = get_blocked_doctypes()
