app_name        = "alaiy_os_core"
app_title       = "Alaiy OS Core"
app_publisher   = "Alaiy"
app_description = "AlaiyOS Core — connector registry and branding layer"
app_email       = "sarthak@alaiy.com"
app_license     = "MIT"
app_version     = "0.0.1"

# Called on first install only (also sets admin password)
after_install = "alaiy_os_core.install.after_install"

# Called after every `bench migrate` — re-applies workspace hiding etc.
after_migrate = "alaiy_os_core.install.after_migrate"

# Injects brand_config into frappe.boot so JS can read it without an API call
extend_bootinfo = ["alaiy_os_core.boot.extend_bootinfo"]

# Injected into every Desk page for every logged-in user
app_include_js  = "/assets/alaiy_os_core/js/alaiy_os_core.js"
app_include_css = "/assets/alaiy_os_core/config/theme.css"
