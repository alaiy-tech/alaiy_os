# alaiy_os_core/client/config/branding_config.py
#
# Client-facing branding — shown on the login page, browser navbar, and
# browser tab.  These represent the CLIENT's brand identity (e.g. Alto Moda),
# NOT the AlaiyOS platform brand.
#
# Place the client's logo files in:
#   public/images/client/
# then run `bench build --app alaiy_os_core` to publish them to assets.

# Horizontal wordmark (used in login page top-left, navbar)
CLIENT_LOGO_HOR    = "/assets/alaiy_os_core/images/client/client-hor.png"

# Square / icon logo (used above the login form)
CLIENT_LOGO_SQUARE = "/assets/alaiy_os_core/images/alaiy/logo-square.png"

# Browser tab favicon
CLIENT_FAVICON     = "/assets/alaiy_os_core/images/alaiy/icon.png"

# Name shown in <title> and System Settings.app_name
CLIENT_APP_NAME    = "Alaiy OS"
