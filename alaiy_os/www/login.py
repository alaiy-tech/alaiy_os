import frappe
from frappe.utils.oauth import get_oauth2_authorize_url, get_oauth_keys
from frappe.utils.password import get_decrypted_password

# Login page carries a per-request OAuth `state` token, so it must not be cached.
no_cache = True


def get_context(context):
    """Expose enabled social-login providers (e.g. Google) to the custom login page.

    Mirrors frappe/www/login.py: only a provider with a client id + secret + valid
    base URL is offered, and its per-request authorize URL is generated here.
    """
    redirect_to = frappe.form_dict.get("redirect-to") or "/desk/ask-alaiy"

    # Already logged in — mirror frappe/www/login.py so hitting /login directly
    # (bookmark, typed URL, etc.) lands you back on the desk instead of
    # showing the login form again.
    if frappe.session.user != "Guest":
        frappe.local.flags.redirect_location = redirect_to
        raise frappe.Redirect

    context.provider_logins = []

    try:
        providers = frappe.get_all(
            "Social Login Key",
            filters={"enable_social_login": 1},
            fields=["name", "client_id", "base_url", "provider_name"],
            order_by="name",
        )
        for p in providers:
            secret = get_decrypted_password(
                "Social Login Key", p.name, "client_secret", raise_exception=False
            )
            if secret and p.client_id and p.base_url and get_oauth_keys(p.name):
                context.provider_logins.append(
                    {
                        "name": p.name,
                        "provider_name": p.provider_name,
                        "auth_url": get_oauth2_authorize_url(p.name, redirect_to),
                    }
                )
    except Exception:
        # Never let a misconfigured provider 500 the login page.
        pass

    return context
