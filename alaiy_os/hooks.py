app_name = "alaiy_os"
app_title = "Alaiy OS"
app_publisher = "Alaiy"
app_description = "Specialized E-commerce OS built on top of Frappe"
app_version = "0.0.1"
required_apps = ["erpnext"]
# Provisioning hooks
after_install = "alaiy_os.setup.install.after_install"
after_migrate = "alaiy_os.setup.install.after_migrate"

# Boot + auth hooks
on_login = "alaiy_os.setup.boot.on_login"

# Site root ("/"). get_website_user_home_page alone isn't enough here: the
# path resolver has a hardcoded fast path that only triggers for a URL
# literally starting with "desk" (frappe/website/path_resolver.py) — the
# home-page hook just substitutes the *template* rendered at "/" without
# changing the browser's actual URL, so the desk SPA boots seeing path "/"
# and falls back to its own default ("Dashboard") instead of "os". A real
# redirect sends the browser to an actual /desk/os request, which does hit
# that fast path — exactly how /app already behaves (301 -> /desk).
website_redirects = [
    {"source": "/", "target": "/desk/os"},
]
get_website_user_home_page = "alaiy_os.setup.boot.get_home_page"

# App-switcher / desk-loading identity — otherwise Frappe falls back to the
# stock Frappe Framework logo wherever an app doesn't set its own.
app_logo_url = "/assets/images/client-logo-square.png"

# Desk assets (loaded for logged-in desk users). Cache-busting version for
# these static files — computed from the current time rather than a
# hand-maintained string, so it changes on every server restart automatically.
# A stale hand-bumped value here is exactly how a content edit to core.css/
# login.css/the JS files below can silently keep serving out of every
# browser's 12-hour asset cache after a deploy — this makes that impossible.
import time as _time
_V = str(int(_time.time()))

# Load order below is dependency order, not stylistic — each file reads
# globals only earlier files define, and none of them use frappe.provide()
# for these shared constants/helpers, so nothing enforces this at build time
# beyond this comment:
#   roles.js             defines ALAIY_OS_ROUTE
#   workspace_config.js  defines ALAIY_SIDEBAR_CONFIG, ALAIY_LABEL_TO_DOCTYPE,
#                        ALAIY_SKIP_LABELS (generated server-side — see
#                        alaiy_os.api.workspace.sidebar_config_js; there is no
#                        public/constants/workspace_config.js file)
#   route_titles.js      defines ALAIY_ROUTE_TITLES, ALAIY_ROUTE_PREFIX_TITLES
#   alaiy_ui.js          reads ALAIY_ROUTE_TITLES/ALAIY_ROUTE_PREFIX_TITLES;
#                        defines window.updateAlaiyTitle/window.resolveAlaiySection
#   alaiy_workspace.js   reads ALAIY_OS_ROUTE, ALAIY_SIDEBAR_CONFIG,
#                        ALAIY_LABEL_TO_DOCTYPE, ALAIY_SKIP_LABELS
#   route_guard.js       reads window.resolveAlaiySection/updateAlaiyTitle
#   alaiy_connector_card.js  no dependency on the above; order-independent
# Reordering this list will silently break with a ReferenceError at runtime —
# there is no compiler or bundler here to catch it.
app_include_js = [
    f"/assets/alaiy_os/constants/roles.js?v={_V}",
    f"/api/method/alaiy_os.api.workspace.sidebar_config_js?v={_V}",
    f"/assets/alaiy_os/constants/route_titles.js?v={_V}",
    f"/assets/alaiy_os/js/alaiy_ui.js?v={_V}",
    f"/assets/alaiy_os/js/alaiy_workspace.js?v={_V}",
    f"/assets/alaiy_os/js/route_guard.js?v={_V}",
    f"/assets/alaiy_os/js/alaiy_connector_card.js?v={_V}",
]
app_include_css = [
    f"/assets/alaiy_os/css/core.css?v={_V}",
    # Served by a whitelisted method (not a static file) so every OS Theme
    # Settings save reflects on the next reload — see alaiy_os/api/theme.py.
    "/api/method/alaiy_os.api.theme.custom_theme_css",
]

# Website assets (login page only — NOT the desk)
web_include_css = [
    f"/assets/alaiy_os/css/login.css?v={_V}",
]
