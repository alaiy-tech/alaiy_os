"""
Catalog API — whitelisted endpoints for the frontend product management screen.
"""

import json
import frappe
from frappe import _


# ── Product catalog ───────────────────────────────────────────────────────────

@frappe.whitelist()
def get_products(
    page=1,
    page_size=20,
    search=None,
    source=None,
    brand=None,
    item_group=None,
):
    """
    Main product list endpoint.
    source: "cloudstore" | "shopify" | None (all)
    Returns items with sync status across both connectors.
    """
    page = int(page)
    per_page = int(page_size)
    filters = {"has_variants": 1}

    if source == "cloudstore":
        filters["cloudstore_id"] = ["!=", ""]
    elif source == "shopify":
        filters["shopify_product_id"] = ["!=", ""]

    if brand:
        filters["brand"] = brand
    if item_group:
        filters["item_group"] = item_group

    or_filters = None
    if search:
        or_filters = [
            ["item_name", "like", f"%{search}%"],
            ["item_code", "like", f"%{search}%"],
            ["brand", "like", f"%{search}%"],
        ]

    items = frappe.get_all(
        "Item",
        filters=filters,
        or_filters=or_filters,
        fields=[
            "item_code", "item_name", "brand", "item_group",
            "cloudstore_id", "cloudstore_sku", "cloudstore_updated_at",
            "shopify_product_id", "shopify_status", "shopify_product_handle",
            "shopify_vendor", "shopify_last_synced",
            "image",
        ],
        limit=per_page,
        start=(page - 1) * per_page,
        order_by="modified desc",
    )

    total = frappe.db.count("Item", filters)

    for item in items:
        item["variant_count"] = frappe.db.count(
            "Item", {"variant_of": item["item_code"]}
        )
        price = frappe.db.get_value(
            "Item Price",
            {
                "item_code": item["item_code"],
                "price_list": "Cloudstore Supplier Price",
            },
            "price_list_rate",
        )
        item["supplier_price"] = float(price) if price else 0.0
        item["push_status"] = "live" if item.get("shopify_product_id") else "not_pushed"

    return {"items": items, "total": total, "page": page, "page_size": per_page}


@frappe.whitelist()
def get_product_detail(item_code: str):
    """Full detail for a single product — template + all variants + prices + sync logs."""
    if not frappe.db.exists("Item", item_code):
        frappe.throw(_("Item {0} not found").format(item_code), frappe.DoesNotExistError)

    item = frappe.get_doc("Item", item_code)

    variants = frappe.get_all(
        "Item",
        filters={"variant_of": item_code},
        fields=[
            "item_code", "item_name",
            "shopify_variant_id", "shopify_inventory_item_id",
            "cloudstore_sku",
        ],
    )
    for v in variants:
        v["attributes"] = frappe.get_all(
            "Item Variant Attribute",
            filters={"parent": v["item_code"]},
            fields=["attribute", "attribute_value"],
        )
        v["prices"] = frappe.get_all(
            "Item Price",
            filters={"item_code": v["item_code"]},
            fields=["price_list", "price_list_rate", "currency"],
        )

    cs_log = frappe.get_all(
        "Cloudstore Sync Log",
        fields=["sync_type", "status", "started_at", "items_synced", "errors"],
        order_by="started_at desc",
        limit=1,
    )
    sh_log = frappe.get_all(
        "Shopify Sync Log",
        fields=["sync_type", "status", "started_at", "items_synced", "errors"],
        order_by="started_at desc",
        limit=1,
    )

    # Shopify shop URL for external link on detail page
    shopify_shop_url = frappe.db.get_single_value("Alaiy OS Settings", "shopify_shop_url") or ""

    return {
        "item": item.as_dict(),
        "variants": variants,
        "last_cloudstore_sync": cs_log[0] if cs_log else None,
        "last_shopify_sync": sh_log[0] if sh_log else None,
        "shopify_shop_url": shopify_shop_url,
    }


@frappe.whitelist()
def get_sync_status():
    """Overall sync health — counts + last sync timestamps. Called by SyncStatusBar."""
    cs_log = frappe.get_all(
        "Cloudstore Sync Log",
        fields=["status", "started_at", "items_synced", "errors"],
        order_by="started_at desc",
        limit=1,
    )
    sh_log = frappe.get_all(
        "Shopify Sync Log",
        fields=["status", "started_at", "items_synced", "errors"],
        order_by="started_at desc",
        limit=1,
    )

    return {
        "cloudstore": {
            "total_items": frappe.db.count("Item", {"cloudstore_id": ["!=", ""]}),
            "last_sync": cs_log[0] if cs_log else None,
        },
        "shopify": {
            "total_pushed": frappe.db.count("Item", {"shopify_product_id": ["!=", ""]}),
            "total_items": frappe.db.count("Item", {"shopify_status": "ACTIVE"}),
            "last_sync": sh_log[0] if sh_log else None,
        },
        "pending_push": frappe.db.count("Item", {
            "cloudstore_id": ["!=", ""],
            "shopify_product_id": ["in", ["", None]],
            "has_variants": 1,
        }),
    }


@frappe.whitelist()
def get_brands():
    """Distinct brands for filter dropdown."""
    rows = frappe.db.sql(
        "SELECT DISTINCT brand FROM `tabItem` WHERE brand != '' AND brand IS NOT NULL ORDER BY brand",
        as_list=True,
    )
    return rows


@frappe.whitelist()
def push_products_to_shopify(item_codes):
    """Enqueue push of multiple products to Shopify."""
    if isinstance(item_codes, str):
        item_codes = json.loads(item_codes)

    queued = []
    for item_code in item_codes:
        if not frappe.db.exists("Item", item_code):
            continue
        frappe.enqueue(
            "alaiy_os_core.connectors.shopify.sync_job.push_item",
            queue="default",
            item_code=item_code,
        )
        queued.append(item_code)

    return {"queued": queued, "count": len(queued)}


@frappe.whitelist()
def trigger_cloudstore_sync():
    """Trigger full Cloudstore catalog pull."""
    frappe.enqueue(
        "alaiy_os_core.connectors.cloudstore.sync_job.sync_full_catalog",
        queue="long",
        timeout=3600,
    )
    return {"status": "queued"}


@frappe.whitelist()
def trigger_shopify_sync():
    """Trigger full Shopify catalog push."""
    frappe.enqueue(
        "alaiy_os_core.connectors.shopify.sync_job.pull_full_catalog",
        queue="long",
        timeout=3600,
    )
    return {"status": "queued"}


@frappe.whitelist()
def update_item_field(item_code: str, fieldname: str, value):
    """
    Update a single enrichment field on an Item from the desk.
    Restricted to safe fields only — connector IDs are read-only.
    """
    SAFE_FIELDS = {
        "item_name", "description", "brand", "item_group",
        "shopify_vendor", "shopify_product_type", "shopify_tags",
        "shopify_status",
    }
    if fieldname not in SAFE_FIELDS:
        frappe.throw(_(f"Field '{fieldname}' cannot be edited from the desk."))

    if not frappe.db.exists("Item", item_code):
        frappe.throw(_("Item {0} not found").format(item_code), frappe.DoesNotExistError)

    frappe.db.set_value("Item", item_code, fieldname, value)
    frappe.db.commit()
    return {"success": True}


# ── Legacy endpoints (keep for backwards compat) ──────────────────────────────

@frappe.whitelist()
def search_items(query: str = "", item_group: str = "", page: int = 1, page_size: int = 20) -> dict:
    """Search synced Items by name or item_code. Returns { "data": [...], "total": int }"""
    filters = [["is_sales_item", "=", 1], ["has_variants", "=", 0]]
    if item_group:
        filters.append(["item_group", "=", item_group])

    or_filters = None
    if query:
        or_filters = [
            ["item_name", "like", f"%{query}%"],
            ["item_code", "like", f"%{query}%"],
        ]

    offset = (int(page) - 1) * int(page_size)
    items = frappe.get_all(
        "Item",
        filters=filters,
        or_filters=or_filters,
        fields=["item_code", "item_name", "item_group", "standard_rate", "cloudstore_id", "cloudstore_sku"],
        limit=int(page_size),
        start=offset,
        order_by="item_name asc",
    )
    total = frappe.db.count("Item", dict(filters))
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
            v["price"] = frappe.db.get_value("Item Price", {"item_code": v["item_code"]}, "price_list_rate")
            v["attributes"] = frappe.get_all(
                "Item Variant Attribute",
                filters={"parent": v["item_code"]},
                fields=["attribute", "attribute_value"],
            )
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
def get_sync_logs(limit: int = 20) -> list:
    """Return recent Cloudstore Sync Log entries."""
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
    """Enqueue a full catalog sync in the background."""
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
