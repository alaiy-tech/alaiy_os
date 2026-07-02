# alaiy_os_core/client/config/boot_config.py
# Configure these values before installing the app.

# ── Company ────────────────────────────────────────────────────────────────────
COMPANY_NAME     = "The Solist"
COMPANY_CURRENCY = "INR"
COMPANY_COUNTRY  = "India"

# ── Localisation ───────────────────────────────────────────────────────────────
# Applied to System Settings on every migrate.
LANGUAGE         = "en"          # e.g. "en", "hi", "ar"
TIMEZONE         = "Asia/Kolkata"

# ── ERPNext onboarding ─────────────────────────────────────────────────────────
# The ERPNext setup wizard asks for fiscal year dates.
# These are used only if ERPNext has not yet been set up.
FISCAL_YEAR_START = "01-01"  # MM-DD — start of fiscal year
FISCAL_YEAR_END   = "12-31"  # MM-DD — end of fiscal year

# ── AlaiyOS workspace onboarding panel ────────────────────────────────────────
# True shows the "Getting Started" panel in the workspace sidebar.
ENABLE_MODULE_ONBOARDING = False
