import frappe


@frappe.whitelist()
def shopify_connect_url(workspace: str, shop: str) -> dict:
    """
    Build the Shopify OAuth authorisation URL for this workspace and shop.

    Called by the self-serve frontend when the seller enters their store domain.
    Delegates to alaiy_os_connector_shopify, which stores a short-lived nonce
    in Redis so the callback can recover which workspace completed the install.
    """
    from alaiy_os_connector_shopify.api.oauth import get_connect_url
    return get_connect_url(workspace=workspace, shop=shop)


def connect_shopify(workspace: str, shop: str, access_token: str) -> None:
    """
    Persist the Shopify OAuth access token after a successful install.

    Called in-process by alaiy_os_connector_shopify.api.oauth.handle_callback
    once the token exchange is complete. Not a whitelisted endpoint — only the
    connector's callback (which runs server-side with no guest exposure) reaches
    this, so no additional auth check is needed here.
    """
    frappe.db.set_single_value("Shopify Connector Settings", "sh_shop_url", f"https://{shop}")
    frappe.db.set_single_value("Shopify Connector Settings", "sh_access_token", access_token)
    frappe.db.set_single_value("Shopify Connector Settings", "is_enabled", 1)
    frappe.db.commit()
