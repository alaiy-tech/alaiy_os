"""
AlaiyOS Core — Branding setup.

================================================================================
WHAT THIS DOES
================================================================================
Replaces ERPNext/Frappe branding (logo, app name, favicon, splash) with Alaiy
branding through Frappe's OWN settings docs — so the navbar, login page and
outgoing emails all pick it up natively. Runs on every deploy (after_migrate),
so the branding is self-healing if ERPNext resets a value during an upgrade.

We never edit core files. We only write to settings singletons:
  * Navbar Settings   -> app_logo (desk navbar logo)
  * Website Settings  -> app_logo / brand_html / favicon / splash image
  * System Settings   -> app name where supported

ASSET PATHS
The real brand assets already live in alaiy_os_core/public/branding/ and are
served by Frappe at /assets/alaiy_os_core/branding/<file>. We reference those.
(If you add files under public/images/, update the constants below.)
================================================================================
"""

import frappe

APP_NAME = "Alaiy"

# Public URLs of bundled brand assets (served from alaiy_os_core/public/branding).
LOGO_URL = "/assets/alaiy_os_core/branding/alaiyos-logo.svg"
FAVICON_URL = "/assets/alaiy_os_core/branding/favicon.ico"
SPLASH_URL = "/assets/alaiy_os_core/branding/icon-512.png"


def apply_branding():
    """
    Push Alaiy branding into Frappe's settings singletons.

    Each write is defensive: field/doctype names differ slightly across Frappe
    versions, so individual failures are swallowed (logged) rather than aborting
    the whole migrate. Idempotent — writing the same value twice is a no-op.
    """
    _set_navbar_logo()
    _set_website_branding()
    _set_app_name()
    frappe.db.commit()


def _safe_set_single(doctype, field, value):
    """set a single-doctype field only if it exists and differs. Never raises."""
    try:
        meta = frappe.get_meta(doctype)
        if not meta.has_field(field):
            return
        if frappe.db.get_single_value(doctype, field) != value:
            frappe.db.set_single_value(doctype, field, value)
    except Exception:
        frappe.log_error(
            title="AlaiyOS: branding set failed",
            message=f"{doctype}.{field} = {value}\n{frappe.get_traceback()}",
        )


def _set_navbar_logo():
    """Desk navbar logo (top-left)."""
    _safe_set_single("Navbar Settings", "app_logo", LOGO_URL)


def _set_website_branding():
    """Login page logo, browser favicon, splash screen and footer brand."""
    _safe_set_single("Website Settings", "app_logo", LOGO_URL)
    _safe_set_single("Website Settings", "banner_image", LOGO_URL)
    _safe_set_single("Website Settings", "favicon", FAVICON_URL)
    _safe_set_single("Website Settings", "splash_image", SPLASH_URL)
    _safe_set_single(
        "Website Settings",
        "brand_html",
        f'<img src="{LOGO_URL}" alt="{APP_NAME}" style="height:24px">',
    )


def _set_app_name():
    """App name used in titles / emails where the field exists."""
    _safe_set_single("System Settings", "app_name", APP_NAME)
    _safe_set_single("Website Settings", "app_name", APP_NAME)


# ------------------------------------------------------------------------------
# PWA MANIFEST OVERRIDE
# ------------------------------------------------------------------------------
# ERPNext serves a web app manifest. We expose a whitelisted endpoint that
# returns an Alaiy-branded manifest. Wire a website_route_rule in hooks.py
# (or point your reverse proxy / a www page at it) to serve it at /manifest.json
# if you want PWA install to show Alaiy icons.
# ------------------------------------------------------------------------------

@frappe.whitelist(allow_guest=True)
def get_manifest():
    """Return an Alaiy-branded PWA manifest as JSON."""
    frappe.local.response.update({"type": "json"})
    return {
        "name": APP_NAME,
        "short_name": APP_NAME,
        "start_url": "/app",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#ffffff",
        "icons": [
            {
                "src": "/assets/alaiy_os_core/branding/icon-192.png",
                "sizes": "192x192",
                "type": "image/png",
            },
            {
                "src": "/assets/alaiy_os_core/branding/icon-512.png",
                "sizes": "512x512",
                "type": "image/png",
            },
        ],
    }
