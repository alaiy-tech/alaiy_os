app_name = "alaiy_os_core"
app_title = "Alaiy OS"
app_publisher = "Alaiy"
app_description = "Specialized E-commerce OS built on top of Frappe"
app_version = "0.0.1"
required_apps = ["erpnext"]
# Provisioning hooks
after_install = "alaiy_os_core.setup.install.after_install"
after_migrate = "alaiy_os_core.setup.install.after_migrate"

# Boot + auth hooks
on_login = "alaiy_os_core.setup.boot.on_login"

# Desk assets (loaded for logged-in desk users)
_V = "20260703a"

app_include_js = [
    f"/assets/alaiy_os_core/constants/roles.js?v={_V}",
    f"/assets/alaiy_os_core/constants/workspace_config.js?v={_V}",
    f"/assets/alaiy_os_core/constants/route_titles.js?v={_V}",
    f"/assets/alaiy_os_core/js/alaiy_ui.js?v={_V}",
    f"/assets/alaiy_os_core/js/alaiy_workspace.js?v={_V}",
    f"/assets/alaiy_os_core/js/route_guard.js?v={_V}",
    f"/assets/alaiy_os_core/js/alaiy_connector_card.js?v={_V}",
]
app_include_css = [
    f"/assets/alaiy_os_core/css/core.css?v={_V}",
]

# Website assets (login page only — NOT the desk)
web_include_css = [
    f"/assets/alaiy_os_core/css/login.css?v={_V}",
]
