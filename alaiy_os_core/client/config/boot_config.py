# alaiy_os_core/client/config/boot_config.py
# Configure these values before installing the app.

# ── Company ────────────────────────────────────────────────────────────────────
# Synced to ERPNext Global Defaults on every bench migrate.
# This drives the workspace title ("<COMPANY_NAME> OS") and the default company.
# If the company record does not yet exist in ERPNext it will be created
# automatically using COMPANY_CURRENCY and COMPANY_COUNTRY.
COMPANY_NAME     = "Alto Moda"
COMPANY_CURRENCY = "INR"
COMPANY_COUNTRY  = "India"

# ── AlaiyOS admin user ─────────────────────────────────────────────────────────
ALAIY_OS_ADMIN_USERNAME = "alaiyosadmin"
ALAIY_OS_ADMIN_EMAIL    = "admin@alaiy.com"
ALAIY_OS_ADMIN_PASSWORD = "alaiyos123"

# ── Features ───────────────────────────────────────────────────────────────────
# Toggle on every migrate — True shows the "Getting Started" onboarding panel
# in the workspace sidebar; False hides it by clearing the module_onboarding
# link on the Workspace Sidebar record.
ENABLE_ONBOARDING = False
