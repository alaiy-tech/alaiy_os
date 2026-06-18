app_name = "alaiy_os_core"
app_title = "Alaiy OS Core"
app_publisher = "AlaiyOS"
app_description = "AlaiyOS core functionality and workspace"
app_version = "0.0.1"

# Provisioning hooks
after_install = "alaiy_os_core.setup.install.after_install"
after_migrate = "alaiy_os_core.setup.install.after_migrate"

# Inject Poppins font for the desk via <link> tag (faster than CSS @import)
head_html = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">'
)

# Boot + auth hooks
boot_session = "alaiy_os_core.setup.boot.boot_session"
on_login = "alaiy_os_core.setup.boot.on_login"

# Desk assets (loaded for logged-in desk users)
app_include_js = [
    # constants — loaded first so all other files can reference these globals
    "/assets/alaiy_os_core/constants/roles.js",
    "/assets/alaiy_os_core/constants/workspace_config.js",
    "/assets/alaiy_os_core/constants/route_titles.js",
    "/assets/alaiy_os_core/constants/settings_tabs.js",
    # shared title / UI utils
    "/assets/alaiy_os_core/js/alaiy_ui.js",
    # workspace embedded content loader (intercepts card + sidebar clicks)
    "/assets/alaiy_os_core/js/alaiy_workspace.js",
    # route guard: /desk redirect + sidebar collapse + title update
    "/assets/alaiy_os_core/js/route_guard.js",
    # settings panel
    "/assets/alaiy_os_core/js/alaiy_settings.js",
]
app_include_css = [
    "/assets/alaiy_os_core/css/core.css",
]

# Website assets (login page only — NOT the desk)
web_include_css = [
    "/assets/alaiy_os_core/css/login.css",
]
