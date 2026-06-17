app_name = "alaiy_os_core"
app_title = "Alaiy OS Core"
app_publisher = "AlaiyOS"
app_description = "AlaiyOS workspace provisioner for ERPNext"
app_version = "0.0.1"

# Provisioning hooks
after_install = "alaiy_os_core.setup.install.after_install"
after_migrate = "alaiy_os_core.setup.install.after_migrate"

# Boot + auth hooks
boot_session = "alaiy_os_core.setup.boot.boot_session"
on_session_creation = "alaiy_os_core.setup.boot.on_session_creation"
on_login = "alaiy_os_core.setup.boot.on_login"

# Desk assets (loaded for logged-in desk users)
app_include_js = [
    # constants — loaded first so all other files can reference these globals
    "/assets/alaiy_os_core/js/constants/route_titles.js",
    "/assets/alaiy_os_core/js/constants/settings_tabs.js",
    # shared title utils
    "/assets/alaiy_os_core/js/alaiy_ui.js",
    "/assets/alaiy_os_core/js/route_guard.js",
    "/assets/alaiy_os_core/js/alaiy_settings.js",
]
app_include_css = [
    "/assets/alaiy_os_core/css/alaiy_os.css",
]

# Website assets (login page only — NOT the desk)
web_include_css = [
    "/assets/alaiy_os_core/css/login.css",
]
