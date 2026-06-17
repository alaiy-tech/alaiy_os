app_name = "alaiy_os_core"
app_title = "Alaiy OS Core"
app_publisher = "AlaiyOS"
app_description = "AlaiyOS workspace provisioner for ERPNext"
app_version = "0.0.1"

# Provisioning hooks
after_install = "alaiy_os_core.setup.install.after_install"
after_migrate = "alaiy_os_core.setup.install.after_migrate"

# Boot hooks — sidebar filtering and login redirect
boot_session = "alaiy_os_core.setup.boot.boot_session"
on_session_creation = "alaiy_os_core.setup.boot.on_session_creation"

# Client-side assets — scoped, minimal
app_include_js = ["/assets/alaiy_os_core/js/route_guard.js"]
app_include_css = ["/assets/alaiy_os_core/css/alaiy_os.css"]
