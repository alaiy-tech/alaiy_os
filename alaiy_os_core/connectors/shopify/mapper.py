"""
Bidirectional mapping between ERPNext Item/Item Variant and Shopify Product/Variant.

All functions are pure — no frappe calls, no network calls.
"""

from __future__ import annotations
from typing import Any


def erpnext_item_to_shopify_product_input(item: dict) -> dict:
    """
    Map an ERPNext Item (dict from frappe.get_doc) to a Shopify
    productCreate/productUpdate input dict.
    """
    return {
        "title": item.get("item_name") or item.get("item_code", ""),
        "descriptionHtml": item.get("description") or "",
        "vendor": item.get("brand") or "",
        "productType": item.get("item_group") or "",
        "status": "ACTIVE" if item.get("disabled") == 0 else "DRAFT",
        "tags": _build_tags(item),
    }


def erpnext_variant_to_shopify_variant_input(
    variant: dict,
    option_values: list[dict] | None = None,
) -> dict:
    """
    Map an ERPNext Item (variant doc) to a Shopify ProductVariantsBulkInput entry.
    """
    v: dict[str, Any] = {
        "sku": variant.get("item_code", ""),
        "price": str(variant.get("standard_rate") or "0.00"),
        "barcode": variant.get("barcodes", [{}])[0].get("barcode", "") if variant.get("barcodes") else "",
        "inventoryPolicy": "DENY",
        "inventoryManagement": "SHOPIFY",
        "weight": variant.get("weight_per_unit"),
        "weightUnit": _map_weight_unit(variant.get("weight_uom", "")),
        "requiresShipping": True,
        "taxable": True,
    }
    if option_values:
        v["optionValues"] = option_values
    return {k: val for k, val in v.items() if val is not None and val != ""}


def shopify_product_to_erpnext(product: dict) -> dict:
    """
    Map a Shopify product node (from GraphQL) to an ERPNext Item dict.
    Used when pulling product updates back from Shopify.
    """
    return {
        "item_name": product.get("title", ""),
        "description": product.get("descriptionHtml") or product.get("description") or "",
        "brand": product.get("vendor", ""),
        "item_group": product.get("productType") or "Products",
        "shopify_product_id": _strip_gid(product.get("id", "")),
        "shopify_product_handle": product.get("handle", ""),
        "shopify_updated_at": product.get("updatedAt") or product.get("updated_at", ""),
    }


def shopify_variant_to_erpnext(variant: dict) -> dict:
    """
    Map a Shopify ProductVariant node to ERPNext Item fields.
    """
    price = variant.get("price", "0")
    sku = variant.get("sku") or ""
    gid = variant.get("id", "")
    inventory_item_gid = variant.get("inventoryItem", {}).get("id", "")

    return {
        "shopify_variant_id": _strip_gid(gid),
        "shopify_inventory_item_id": _strip_gid(inventory_item_gid),
        "standard_rate": float(price) if price else 0.0,
        "item_code": sku,
    }


def build_product_options(attributes: list[str]) -> list[dict]:
    """
    Build Shopify product options list from a list of ERPNext attribute names.
    e.g. ["Size", "Color"] → [{"name": "Size"}, {"name": "Color"}]
    """
    return [{"name": attr} for attr in attributes]


def build_option_values_for_variant(
    variant_attributes: dict[str, str],
    option_order: list[str],
) -> list[dict]:
    """
    Given variant attribute values and the ordered option names,
    produce the optionValues list for Shopify's productVariantsBulkCreate.
    """
    return [
        {"optionName": attr, "name": variant_attributes.get(attr, "")}
        for attr in option_order
    ]


# ── helpers ──────────────────────────────────────────────────────────────────

def _strip_gid(gid: str) -> str:
    """'gid://shopify/Product/12345' → '12345'"""
    if "/" in gid:
        return gid.rsplit("/", 1)[-1]
    return gid


def _build_tags(item: dict) -> list[str]:
    tags = []
    if item.get("brand"):
        tags.append(item["brand"])
    if item.get("item_group") and item["item_group"] not in ("All Item Groups", "Products"):
        tags.append(item["item_group"])
    return tags


def _map_weight_unit(uom: str) -> str:
    mapping = {
        "Kg": "KILOGRAMS",
        "kg": "KILOGRAMS",
        "KG": "KILOGRAMS",
        "g": "GRAMS",
        "G": "GRAMS",
        "Gram": "GRAMS",
        "lb": "POUNDS",
        "LB": "POUNDS",
        "oz": "OUNCES",
        "OZ": "OUNCES",
    }
    return mapping.get(uom, "KILOGRAMS")
