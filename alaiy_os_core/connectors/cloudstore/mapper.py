"""
Transform raw Cloudstore API payloads into ERPNext-ready dicts.

Rules:
- All functions return plain dicts; no frappe.get_doc() calls here.
- MongoDB _id.$oid fields are unwrapped to plain strings.
- Caller is responsible for handling None / missing fields gracefully.
"""

from __future__ import annotations


def _oid(value: dict | str | None) -> str | None:
    """Unwrap MongoDB { "$oid": "..." } to a plain string, or pass through."""
    if isinstance(value, dict):
        return value.get("$oid") or value.get("_id")
    return value


def map_category(raw: dict) -> dict:
    """
    Raw Cloudstore category → ERPNext Item Group dict.

    {
        "cloudstore_id": str,
        "name": str,
        "parent_id": str | None,
    }
    """
    return {
        "cloudstore_id": _oid(raw.get("_id")) or raw.get("id"),
        "name": (raw.get("name") or "").strip(),
        "parent_id": _oid(raw.get("parent_id")) or raw.get("parent_id"),
    }


def map_product_template(raw: dict) -> dict:
    """
    Raw Cloudstore product → ERPNext Item template dict.

    Covers only template-level fields; variant-level SKU fields are in
    map_variant().
    """
    product_id = _oid(raw.get("_id")) or raw.get("id") or ""
    return {
        "cloudstore_id": product_id,
        # item_code will be derived as CS-<product_id> by the service layer
        "item_name": (raw.get("name") or raw.get("title") or "").strip(),
        "description": raw.get("description") or "",
        "item_group": raw.get("category_name") or raw.get("category") or "Products",
        "brand": raw.get("brand") or "",
        "has_variants": 1,
        "cloudstore_updated_at": raw.get("updated_at") or raw.get("updatedAt") or "",
        # Raw attributes list — service layer converts these to Item Attribute rows
        "_raw_attributes": raw.get("attributes") or [],
        "_raw_images": raw.get("images") or [],
    }


def map_variant(raw_variant: dict, parent_item_code: str) -> dict:
    """
    Raw Cloudstore variant / SKU → ERPNext Item variant dict.

    {
        "cloudstore_id": str,
        "cloudstore_sku": str,
        "item_code": str,        # CS-<sku_id>
        "variant_of": str,       # parent_item_code
        "attributes": list[dict] # [{"attribute": "Colour", "attribute_value": "Red"}, ...]
        "standard_rate": float,
        "weight_per_unit": float | None,
        "_raw": dict             # full raw variant for anything the caller needs
    }
    """
    sku_id = _oid(raw_variant.get("_id")) or raw_variant.get("id") or raw_variant.get("sku_id") or ""
    sku_code = raw_variant.get("sku") or raw_variant.get("sku_code") or sku_id

    attributes = []
    for attr in raw_variant.get("attributes") or []:
        name = attr.get("name") or attr.get("attribute") or ""
        value = attr.get("value") or attr.get("attribute_value") or ""
        if name and value:
            attributes.append({"attribute": name.strip(), "attribute_value": str(value).strip()})

    price = raw_variant.get("price") or raw_variant.get("wholesale_price") or 0
    try:
        price = float(price)
    except (TypeError, ValueError):
        price = 0.0

    weight = raw_variant.get("weight") or raw_variant.get("weight_per_unit")
    try:
        weight = float(weight) if weight is not None else None
    except (TypeError, ValueError):
        weight = None

    return {
        "cloudstore_id": sku_id,
        "cloudstore_sku": sku_code,
        "item_code": f"CS-{sku_id}",
        "variant_of": parent_item_code,
        "attributes": attributes,
        "standard_rate": price,
        "weight_per_unit": weight,
        "_raw": raw_variant,
    }


def map_stock_update(raw: dict) -> dict:
    """
    Raw stock record → { "sku_id": str, "quantity": int }
    Handles both query-response and event payload shapes.
    """
    sku_id = _oid(raw.get("sku_id")) or _oid(raw.get("_id")) or raw.get("sku_id") or ""
    qty = raw.get("quantity") or raw.get("qty") or raw.get("stock") or 0
    try:
        qty = int(qty)
    except (TypeError, ValueError):
        qty = 0
    return {"sku_id": sku_id, "quantity": qty}


def map_order_payload(erpnext_po: dict) -> dict:
    """
    ERPNext Purchase Order dict → Cloudstore order push payload.

    Expected input keys (from service layer):
        supplier_order_id, items: [{ sku_id, qty, unit_price }],
        shipping_address: { ... }
    """
    return {
        "external_order_id": erpnext_po.get("supplier_order_id") or erpnext_po.get("name"),
        "items": [
            {
                "sku_id": item["sku_id"],
                "quantity": item["qty"],
                "unit_price": item.get("unit_price"),
            }
            for item in erpnext_po.get("items", [])
        ],
        "shipping_address": erpnext_po.get("shipping_address") or {},
        "notes": erpnext_po.get("notes") or "",
    }
