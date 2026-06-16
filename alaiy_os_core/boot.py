"""
AlaiyOS Core — bootinfo injection.

Two boot hooks run on every Desk page load (wired in hooks.py under
`extend_bootinfo`):

  1. extend_bootinfo                  — brand/feature flags for the JS layer.
  2. inject_branding_and_restrictions — branding URLs, per-user blocked lists,
                                        and global UX toggles consumed by
                                        route_guard.js / ui_overrides.js.

Injecting these into frappe.boot means the JS layer needs NO extra API round-trip.

CRITICAL — NEVER CRASH THE SESSION
A bootinfo hook that raises takes the WHOLE site down with
`frappe.exceptions.SessionBootFailed` (no user can log in). Every injector below
is therefore wrapped in a try/except that logs and continues. Worst case a single
flag is missing client-side; the site still boots.
"""

import frappe

from alaiy_os_core.public.config import brand_config as cfg
from alaiy_os_core.config.workspace_config import (
    GLOBAL_CONFIG,
    get_blocked_doctypes,
    get_blocked_routes,
    get_enabled_workspaces,
)
from alaiy_os_core.permissions import is_system_admin
from alaiy_os_core import branding


def extend_bootinfo(bootinfo):
    """Inject AlaiyOS feature flags into frappe.boot so the JS layer reads them."""
    try:
        bootinfo.alaiy_config = frappe._dict(
            hide_desktop_option=cfg.HIDE_DESKTOP_OPTION,
            redirect_home_to_workspace=cfg.REDIRECT_HOME_TO_WORKSPACE,
            custom_theme=cfg.CUSTOM_THEME,
            toggle_default_theme=cfg.TOGGLE_DEFAULT_THEME,
            visible_workspaces=cfg.VISIBLE_WORKSPACES,
        )
    except Exception:
        # Never let a bootinfo error crash the whole session.
        frappe.log_error(
            title="AlaiyOS: extend_bootinfo failed",
            message=frappe.get_traceback(),
        )


def inject_branding_and_restrictions(bootinfo):
    """
    Inject branding, restrictions and global UX toggles into frappe.boot.

    Wrapped in try/except so a failure here can never raise SessionBootFailed
    and lock everyone out of the site.

    Keys injected:
      * app_logo_url / app_name      — branding (all users)
      * allowed_workspaces           — enabled workspace names (all users)
      * blocked_doctypes             — DocType names blocked for non-admins
      * blocked_routes               — route patterns for route_guard.js
      * hide_onboarding              — True hides the .onb-panel (ui_overrides.js)
      * show_desk_homepage           — False -> redirect bare desk to default_route
      * default_route                — workspace slug to land on (e.g. "stock")
    """
    try:
        is_admin = is_system_admin(frappe.session.user)

        # ── Branding — available to every session for the navbar layer. ───────
        bootinfo.app_logo_url = branding.LOGO_URL
        bootinfo.app_name = branding.APP_NAME

        # ── Enabled workspaces — so the JS layer / app-switcher can filter. ───
        bootinfo.allowed_workspaces = get_enabled_workspaces()

        # ── Global UX toggles (from GLOBAL_CONFIG). ───────────────────────────
        bootinfo.hide_onboarding = not GLOBAL_CONFIG.get("show_onboarding_panel", False)
        bootinfo.show_desk_homepage = GLOBAL_CONFIG.get("show_desk_homepage", False)
        bootinfo.default_route = GLOBAL_CONFIG.get("default_route", "stock")

        # ── Restrictions — role-scoped. Admins see everything (empty lists). ──
        #   blocked_doctypes -> DocType names (UI helpers / belt-and-suspenders)
        #   blocked_routes   -> patterns route_guard.js matches:
        #       "stock-entry", "query-report/Stock Projected Qty", ...
        if is_admin:
            bootinfo.blocked_doctypes = []
            bootinfo.blocked_routes = []
        else:
            bootinfo.blocked_doctypes = get_blocked_doctypes()
            bootinfo.blocked_routes = get_blocked_routes()
    except Exception:
        # Never let a bootinfo error crash the whole session. Fall back to safe
        # empty/defaults so the desk still loads.
        frappe.log_error(
            title="AlaiyOS: inject_branding_and_restrictions failed",
            message=frappe.get_traceback(),
        )
        bootinfo.blocked_doctypes = getattr(bootinfo, "blocked_doctypes", [])
        bootinfo.blocked_routes = getattr(bootinfo, "blocked_routes", [])
