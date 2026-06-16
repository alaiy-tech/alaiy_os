import os as _os

# Pre-built mapping {BlockedDocType: [dotted.path]} driven by workspace_config.
# Imported at load time so adding/removing a DocType in config automatically
# adds/removes its runtime permission guard on the next bench restart.
from alaiy_os_core.permissions import HAS_PERMISSION_HOOK

app_name        = "alaiy_os_core"
app_title       = "Alaiy OS Core"
app_publisher   = "Alaiy"
app_description = "AlaiyOS Core — connector registry and branding layer"
app_email       = "sarthak@alaiy.com"
app_license     = "MIT"
app_version     = "0.0.1"

# ── Deploy-time propagation ───────────────────────────────────────────────────
# after_install: first install only (also sets admin password + full setup).
# after_migrate: every `bench migrate` — re-applies workspace patch + branding,
#                so config changes propagate automatically on every deploy.
after_install = "alaiy_os_core.install.after_install"
after_migrate = "alaiy_os_core.install.after_migrate"

# ── Bootinfo (server -> JS client) ────────────────────────────────────────────
# 1. extend_bootinfo: brand/feature flags for the legacy JS layer.
# 2. inject_branding_and_restrictions: app logo/name + per-user blocked_doctypes
#    list that route_guard.js reads to block navigation for non-admins.
extend_bootinfo = [
    "alaiy_os_core.boot.extend_bootinfo",
    "alaiy_os_core.boot.inject_branding_and_restrictions",
]

# ── Branding ──────────────────────────────────────────────────────────────────
# Desk navbar logo (used by Frappe natively in the top-left navbar).
app_logo_url = "/assets/alaiy_os_core/branding/alaiyos-logo.svg"

# ── Runtime permission enforcement ────────────────────────────────────────────
# For each blocked DocType, deny access to non-System-Administrators so direct
# URL navigation shows a proper permission error instead of a broken page.
has_permission = HAS_PERMISSION_HOOK

# ── PWA manifest override (optional) ──────────────────────────────────────────
# Serve an Alaiy-branded manifest. Point your reverse proxy / front-end at this
# route if you want PWA install to show Alaiy icons.
website_route_rules = [
    {"from_route": "/alaiy-manifest.json", "to_route": "alaiy_os_core.branding.get_manifest"},
]

# Use file mtime as cache-buster so browsers always load the latest CSS/JS
# after bench build + gunicorn restart, without needing a manual hard-refresh.
def _v(rel):
    try:
        return str(int(_os.path.getmtime(_os.path.join(_os.path.dirname(__file__), rel))))
    except Exception:
        return "1"

# ── Desk asset includes ───────────────────────────────────────────────────────
# JS: main desk customisations + the client-side route guard.
# CSS: theme overrides + branding (logo/favicon) overrides.
app_include_js = [
    "/assets/alaiy_os_core/js/alaiy_os_core.js?v=" + _v("public/js/alaiy_os_core.js"),
    "/assets/alaiy_os_core/js/route_guard.js?v=" + _v("public/js/route_guard.js"),
]
app_include_css = [
    "/assets/alaiy_os_core/config/theme.css?v=" + _v("public/config/theme.css"),
    "/assets/alaiy_os_core/css/branding.css?v=" + _v("public/css/branding.css"),
]
