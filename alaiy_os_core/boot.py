import frappe
from alaiy_os_core.public.config import brand_config as cfg


def extend_bootinfo(bootinfo):
    """Inject AlaiyOS config into frappe.boot so the JS layer reads it."""
    bootinfo.alaiy_config = frappe._dict(
        hide_desktop_option=cfg.HIDE_DESKTOP_OPTION,
        redirect_home_to_workspace=cfg.REDIRECT_HOME_TO_WORKSPACE,
        custom_theme=cfg.CUSTOM_THEME,
        toggle_default_theme=cfg.TOGGLE_DEFAULT_THEME,
        visible_workspaces=cfg.VISIBLE_WORKSPACES,
    )
