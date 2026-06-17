"""
AlaiyOS Core — central brand / feature-flag configuration.

Edit this file per client before deploying.
Python reads it directly; JS reads it via frappe.boot.alaiy_config
(injected by boot.py through the extend_bootinfo hook).
"""

# ── Admin ─────────────────────────────────────────────────────
# Set once on fresh install (after_install). Never reset on migrate.
DEFAULT_ADMIN_PASSWORD = "admin123"

# ── Workspaces ────────────────────────────────────────────────
# Every workspace NOT in this list gets is_hidden = 1 on every setup run.
VISIBLE_WORKSPACES = ["Stock"]

# ── Navigation ────────────────────────────────────────────────
# Remove "Desktop" from the top-left app-switcher dropdown.
HIDE_DESKTOP_OPTION = True

# Redirect empty / home route → first workspace in VISIBLE_WORKSPACES.
REDIRECT_HOME_TO_WORKSPACE = True

# ── Theme ─────────────────────────────────────────────────────
# Apply alaiy_os_core/public/config/theme.css overrides to ERPNext Desk.
# When True, TOGGLE_DEFAULT_THEME is automatically forced to False.
CUSTOM_THEME = True

# Show the light/dark mode switcher in the user-settings dropdown.
# Set False (or leave as auto) when CUSTOM_THEME = True.
TOGGLE_DEFAULT_THEME = not CUSTOM_THEME

# ── About modal ───────────────────────────────────────────────
ABOUT_WEBSITE_URL = "https://alaiy.com"
ABOUT_GITHUB_URL = "https://github.com/alaiy-tech"
ABOUT_FOOTER_TEXT = "Built with ♥ by Alaiy"

# ── Connectors ────────────────────────────────────────────────
# IDs of connector integrations to activate on next `bench migrate`.
# Supported values: "shopify"
ENABLED_CONNECTORS: list[str] = ["shopify"]

# Base URL of the Shopify connector server (used to register Frappe webhooks
# that POST to the connector). Set to the connector's public URL, e.g. an
# ngrok/Cloudflare Tunnel URL in local dev.
# Required when "shopify" is in ENABLED_CONNECTORS.
SHOPIFY_CONNECTOR_URL: str = ""
