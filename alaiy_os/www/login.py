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
    context.provider_logins = []
    redirect_to = frappe.form_dict.get("redirect-to") or "/desk/os"

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
