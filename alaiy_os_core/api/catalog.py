"""
Catalog API — whitelisted endpoints for the frontend to browse and manage
Cloudstore-synced items.
"""

import frappe
from frappe import _


@frappe.whitelist()
def search_items(query: str = "", item_group: str = "", page: int = 1, page_size: int = 20) -> dict:
    """
    Search synced Items by name or item_code.

    Returns { "data": [...], "total": int }
    """
    filters = [["is_sales_item", "=", 1], ["has_variants", "=", 0]]

    if item_group:
        filters.append(["item_group", "=", item_group])

    if query:
        or_filters = [
            ["item_name", "like", f"%{query}%"],
            ["item_code", "like", f"%{query}%"],
        ]
    else:
        or_filters = []

    offset = (int(page) - 1) * int(page_size)

    items = frappe.get_all(
        "Item",
        filters=filters,
        or_filters=or_filters if or_filters else None,
        fields=["item_code", "item_name", "item_group", "standard_rate", "cloudstore_id", "cloudstore_sku"],
        limit=int(page_size),
        start=offset,
        order_by="item_name asc",
    )

    total = frappe.db.count(
        "Item",
        filters=dict(filters),
    )

    return {"data": items, "total": total}


@frappe.whitelist()
def get_item(item_code: str) -> dict:
    """Return full item details including variants and prices."""
    if not frappe.db.exists("Item", item_code):
        frappe.throw(_("Item {0} not found").format(item_code), frappe.DoesNotExistError)

    item = frappe.get_doc("Item", item_code)
    variants = []

    if item.has_variants:
        raw_variants = frappe.get_all(
            "Item",
            filters={"variant_of": item_code},
            fields=["item_code", "item_name", "cloudstore_id", "cloudstore_sku"],
        )
        for v in raw_variants:
            price = frappe.db.get_value(
                "Item Price",
                {"item_code": v["item_code"]},
                "price_list_rate",
            )
            v["price"] = price
            attrs = frappe.get_all(
                "Item Variant Attribute",
                filters={"parent": v["item_code"]},
                fields=["attribute", "attribute_value"],
            )
            v["attributes"] = attrs
            variants.append(v)

    return {
        "item_code": item.item_code,
        "item_name": item.item_name,
        "item_group": item.item_group,
        "description": item.description,
        "brand": item.brand,
        "has_variants": item.has_variants,
        "cloudstore_id": item.get("cloudstore_id"),
        "cloudstore_updated_at": item.get("cloudstore_updated_at"),
        "variants": variants,
    }


@frappe.whitelist()
def get_sync_logs(limit: int = 20) -> list[dict]:
    """Return recent Cloudstore Sync Log entries for the dashboard."""
    return frappe.get_all(
        "Cloudstore Sync Log",
        fields=[
            "name", "sync_type", "status", "started_at", "finished_at",
            "items_fetched", "items_created", "items_updated", "items_skipped",
        ],
        limit=int(limit),
        order_by="started_at desc",
    )


@frappe.whitelist()
def trigger_full_sync() -> dict:
    """
    Enqueue a full catalog sync in the background.
    Requires System Manager role.
    """
    frappe.only_for("System Manager")
    frappe.enqueue(
        "alaiy_os_core.connectors.cloudstore.sync_job.sync_full_catalog",
        queue="long",
        job_name="cloudstore_full_catalog_sync",
        is_async=True,
    )
    return {"message": "Full catalog sync enqueued."}


@frappe.whitelist()
def trigger_incremental_sync() -> dict:
    """Enqueue an incremental sync in the background."""
    frappe.only_for("System Manager")
    frappe.enqueue(
        "alaiy_os_core.connectors.cloudstore.sync_job.sync_incremental",
        queue="short",
        job_name="cloudstore_incremental_sync",
        is_async=True,
    )
    return {"message": "Incremental sync enqueued."}
