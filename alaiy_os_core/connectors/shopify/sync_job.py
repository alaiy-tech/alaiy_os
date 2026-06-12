"""
Scheduled sync jobs for the Shopify connector.

Registered in hooks.py → scheduler_events.
Each function is a standalone entry point called by the Frappe scheduler.
`push_item` is also called via frappe.enqueue from the catalog API.
"""

from __future__ import annotations
import frappe
from frappe.utils import now_datetime
from .client import ShopifyClient


def _get_client() -> ShopifyClient | None:
    """
    Read credentials from Alaiy OS Settings and return a ready client.
    Returns None if the connector is disabled or credentials are missing.
    """
    settings = frappe.get_single("Alaiy OS Settings")
    if not settings.shopify_enabled:
        return None

    shop_url = settings.shopify_shop_url or ""
    access_token = settings.shopify_access_token or ""

    if not shop_url or not access_token:
        frappe.log_error("Shopify credentials missing in Alaiy OS Settings", "Shopify sync skipped")
        return None

    try:
        return ShopifyClient(shop_url=shop_url, access_token=access_token)
    except ValueError as e:
        frappe.log_error(str(e), "Shopify sync skipped")
        return None


def _log_sync(
    sync_type: str,
    status: str,
    message: str,
    details: str = "",
    items_synced: int = 0,
    errors: int = 0,
    started_at=None,
) -> None:
    """Write a row to the Shopify Sync Log DocType."""
    try:
        doc = frappe.new_doc("Shopify Sync Log")
        doc.sync_type = sync_type
        doc.status = status
        doc.message = message[:500]
        doc.details = details[:5000]
        doc.items_synced = items_synced
        doc.errors = errors
        doc.started_at = started_at or now_datetime()
        doc.finished_at = now_datetime()
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
    except Exception:
        pass


def push_item(item_code: str) -> None:
    """
    Push a single Item to Shopify — images, metafields, publish.
    Called via frappe.enqueue from alaiy_os_core.api.catalog.push_products_to_shopify.
    Does NOT check shopify_push_enabled — the user is explicitly requesting the push.
    """
    started = now_datetime()
    client = _get_client()
    if not client:
        return

    from .product_service import push_item_to_shopify
    from .media_service import push_item_images
    from .metafield_service import push_item_metafields
    from .publish_service import publish_product

    try:
        result = push_item_to_shopify(client, item_code)
        shopify_id = result.get("shopify_product_id", "")
        product_gid = f"gid://shopify/Product/{shopify_id}"

        push_item_images(client, item_code, shopify_id)
        push_item_metafields(client, item_code, product_gid)
        publish_product(client, product_gid)

        # Mark item as ACTIVE + record last synced timestamp
        frappe.db.set_value("Item", item_code, {
            "shopify_status": "ACTIVE",
            "shopify_last_synced": now_datetime(),
        }, update_modified=False)
        frappe.db.commit()

        _log_sync(
            "Product Push",
            "Success",
            f"Pushed {item_code} to Shopify",
            str(result),
            items_synced=1,
            errors=0,
            started_at=started,
        )
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Shopify push failed: {item_code}")
        _log_sync(
            "Product Push",
            "Failed",
            f"Failed to push {item_code}: {str(e)[:200]}",
            frappe.get_traceback()[:5000],
            items_synced=0,
            errors=1,
            started_at=started,
        )


def pull_full_catalog() -> None:
    """
    Daily job: push all active Items that have shopify_push_enabled=1 to Shopify.
    Also syncs locations, collections, media, and metafields.
    """
    started = now_datetime()
    client = _get_client()
    if not client:
        return

    from .product_service import push_item_to_shopify
    from .collection_service import sync_item_group_collections
    from .inventory_service import sync_locations, push_all_inventory
    from .media_service import push_item_images
    from .metafield_service import push_item_metafields
    from .publish_service import publish_product

    try:
        sync_locations(client)
        sync_item_group_collections(client)

        items = frappe.get_all(
            "Item",
            filters={
                "disabled": 0,
                "shopify_push_enabled": 1,
                "has_variants": ["in", [0, 1]],
                "variant_of": "",
            },
            pluck="name",
        )

        pushed = 0
        error_list = []
        for item_code in items:
            try:
                result = push_item_to_shopify(client, item_code)
                shopify_id = result.get("shopify_product_id", "")
                product_gid = f"gid://shopify/Product/{shopify_id}"
                push_item_images(client, item_code, shopify_id)
                push_item_metafields(client, item_code, product_gid)
                publish_product(client, product_gid)
                frappe.db.set_value("Item", item_code, {
                    "shopify_status": "ACTIVE",
                    "shopify_last_synced": now_datetime(),
                }, update_modified=False)
                pushed += 1
            except Exception as e:
                error_list.append({"item": item_code, "error": str(e)})
                frappe.log_error(str(e), f"Shopify product push failed: {item_code}")

        frappe.db.commit()

        inv_result = push_all_inventory(client)
        status = "Success" if not error_list else "Partial"
        _log_sync(
            "Full Catalog",
            status,
            f"Pushed {pushed}/{len(items)} products. Inventory: {inv_result.get('pushed', 0)} items.",
            str({"errors": error_list, "inventory_errors": inv_result.get("errors", [])}),
            items_synced=pushed,
            errors=len(error_list),
            started_at=started,
        )

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Shopify full catalog sync failed")
        _log_sync("Full Catalog", "Failed", str(e)[:500], started_at=started)


def pull_inventory() -> None:
    """Every 15 minutes: push current inventory quantities to Shopify."""
    started = now_datetime()
    client = _get_client()
    if not client:
        return

    from .inventory_service import push_all_inventory

    try:
        result = push_all_inventory(client)
        status = "Success" if not result.get("errors") else "Partial"
        _log_sync(
            "Inventory Sync",
            status,
            f"Pushed {result.get('pushed', 0)} inventory levels.",
            str(result.get("errors", [])),
            items_synced=result.get("pushed", 0),
            errors=len(result.get("errors", [])),
            started_at=started,
        )
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Shopify inventory sync failed")
        _log_sync("Inventory Sync", "Failed", str(e)[:500], started_at=started)
