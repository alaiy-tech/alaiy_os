"""
Shopify connector API endpoints — called by the frontend.
"""

import frappe
from alaiy_os_core.connectors.shopify.client import ShopifyClient


def _get_client() -> ShopifyClient:
    settings = frappe.get_single("Alaiy OS Settings")
    return ShopifyClient(
        shop_url=settings.shopify_shop_url or "",
        access_token=settings.shopify_access_token or "",
    )


@frappe.whitelist()
def push_product(item_code: str) -> dict:
    """Manually push a single ERPNext Item to Shopify."""
    from alaiy_os_core.connectors.shopify.product_service import push_item_to_shopify
    from alaiy_os_core.connectors.shopify.media_service import push_item_images
    from alaiy_os_core.connectors.shopify.metafield_service import push_item_metafields
    from alaiy_os_core.connectors.shopify.publish_service import publish_product

    client = _get_client()
    result = push_item_to_shopify(client, item_code)

    shopify_id = result.get("shopify_product_id", "")
    if shopify_id:
        product_gid = f"gid://shopify/Product/{shopify_id}"
        push_item_images(client, item_code, shopify_id)
        push_item_metafields(client, item_code, product_gid)
        publish_product(client, product_gid)

    return result


@frappe.whitelist()
def sync_inventory() -> dict:
    """Manually trigger an inventory sync."""
    from alaiy_os_core.connectors.shopify.inventory_service import push_all_inventory

    client = _get_client()
    return push_all_inventory(client)


@frappe.whitelist()
def sync_locations() -> list:
    """Refresh Shopify locations into the Shopify Location DocType."""
    from alaiy_os_core.connectors.shopify.inventory_service import sync_locations as _sync

    client = _get_client()
    return _sync(client)


@frappe.whitelist()
def get_sync_logs(limit: int = 50) -> list:
    """Return the most recent Shopify Sync Log entries."""
    return frappe.get_all(
        "Shopify Sync Log",
        fields=["name", "sync_type", "status", "message", "creation"],
        order_by="creation desc",
        limit=int(limit),
    )
