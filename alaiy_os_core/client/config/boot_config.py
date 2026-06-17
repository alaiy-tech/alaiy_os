# alaiy_os_core/client/config/boot_config.py
# Configure these values before installing the app.

ALAIY_OS_ADMIN_USERNAME = "alaiyosadmin"       # Used as the login username
# Used as the user's email (metadata)
ALAIY_OS_ADMIN_EMAIL = "admin@alaiy.com"
# Temporary password — change after first login
ALAIY_OS_ADMIN_PASSWORD = "alaiyos123"

# Standard ERPNext workspaces from which AlaiyOS roles are removed on every
# migrate, so they don’t appear in the sidebar for AlaiyOS users.
# Add/remove workspace names here to control what is hidden.
STANDARD_WORKSPACES_TO_HIDE = [
    "Stock", "Selling", "Buying", "Accounting", "HR", "CRM",
    "Manufacturing", "Projects", "Assets", "Quality", "Support",
    "Payroll", "ERPNext Integrations", "Settings", "Users",
    "Build", "Home", "Learn", "Website", "Customization",
]
