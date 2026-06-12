"""
Product push service: ERPNext Item → Shopify product (3-step flow).

Step 1: productCreate — create the product shell with options.
Step 2: productVariantsBulkCreate — add all variants in one call.
Step 3: productPublish / media / metafields (delegated to other services).

Frappe is only accessed via the caller (sync_job.py), which passes frappe doc
dicts. This module itself may call frappe for DB writes (shopify_product_id etc).
"""

from __future__ import annotations
import frappe
from .client import ShopifyClient, ShopifyUserError
from .mapper import (
    erpnext_item_to_shopify_product_input,
    erpnext_variant_to_shopify_variant_input,
    build_product_options,
    build_option_values_for_variant,
    _strip_gid,
)


# ── GraphQL fragments ─────────────────────────────────────────────────────────

_PRODUCT_CORE_FIELDS = """
  id
  title
  handle
  status
  updatedAt
  options { id name values }
  variants(first: 100) {
    edges {
      node {
        id
        sku
        price
        inventoryItem { id }
      }
    }
  }
"""

_CREATE_PRODUCT_MUTATION = """
mutation productCreate($input: ProductInput!) {
  productCreate(input: $input) {
    product { %s }
    userErrors { field message }
  }
}
""" % _PRODUCT_CORE_FIELDS

_UPDATE_PRODUCT_MUTATION = """
mutation productUpdate($input: ProductInput!) {
  productUpdate(input: $input) {
    product { %s }
    userErrors { field message }
  }
}
""" % _PRODUCT_CORE_FIELDS

_BULK_CREATE_VARIANTS_MUTATION = """
mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkCreate(productId: $productId, variants: $variants) {
    productVariants {
      id
      sku
      inventoryItem { id }
    }
    userErrors { field message }
  }
}
"""

_BULK_UPDATE_VARIANTS_MUTATION = """
mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants {
      id
      sku
      price
    }
    userErrors { field message }
  }
}
"""

_GET_PRODUCT_QUERY = """
query getProduct($id: ID!) {
  product(id: $id) { %s }
}
""" % _PRODUCT_CORE_FIELDS


# ── Public API ────────────────────────────────────────────────────────────────

def push_item_to_shopify(client: ShopifyClient, item_code: str) -> dict:
    """
    Push a single ERPNext Item (template) and all its variants to Shopify.
    Idempotent: creates if no shopify_product_id, updates otherwise.
    Returns {"shopify_product_id": "...", "variants_pushed": N}.
    """
    item = frappe.get_doc("Item", item_code)

    if item.shopify_product_id:
        return _update_product(client, item)
    else:
        return _create_product(client, item)


def get_shopify_product(client: ShopifyClient, shopify_product_id: str) -> dict:
    """Fetch a product from Shopify by numeric ID. Returns the product node."""
    gid = f"gid://shopify/Product/{shopify_product_id}"
    data = client.execute(_GET_PRODUCT_QUERY, {"id": gid})
    return data.get("product") or {}


# ── Internal helpers ──────────────────────────────────────────────────────────

def _create_product(client: ShopifyClient, item) -> dict:
    """3-step product creation."""
    # Step 1: create product shell
    product_input = erpnext_item_to_shopify_product_input(item.as_dict())
    variants_raw = _get_variants(item)
    option_names = _infer_option_names(variants_raw)
    product_input["options"] = option_names

    data = client.mutate(
        _CREATE_PRODUCT_MUTATION,
        {"input": product_input},
        user_errors_path=["productCreate", "userErrors"],
    )
    product = data["productCreate"]["product"]
    shopify_product_id = _strip_gid(product["id"])
    gid = product["id"]

    # Record product ID on the template item
    frappe.db.set_value("Item", item.name, "shopify_product_id", shopify_product_id, update_modified=False)

    # Step 2: create variants
    n_variants = _push_variants(client, gid, variants_raw, option_names)

    return {"shopify_product_id": shopify_product_id, "variants_pushed": n_variants}


def _update_product(client: ShopifyClient, item) -> dict:
    gid = f"gid://shopify/Product/{item.shopify_product_id}"
    product_input = erpnext_item_to_shopify_product_input(item.as_dict())
    product_input["id"] = gid

    client.mutate(
        _UPDATE_PRODUCT_MUTATION,
        {"input": product_input},
        user_errors_path=["productUpdate", "userErrors"],
    )

    variants_raw = _get_variants(item)
    option_names = _infer_option_names(variants_raw)
    n_variants = _push_variants(client, gid, variants_raw, option_names, update=True)

    return {"shopify_product_id": item.shopify_product_id, "variants_pushed": n_variants}


def _get_variants(item) -> list:
    """Return list of ERPNext Item dicts for all active variants of a template."""
    if item.has_variants:
        variant_codes = frappe.get_all(
            "Item",
            filters={"variant_of": item.name, "disabled": 0},
            pluck="name",
        )
        return [frappe.get_doc("Item", vc).as_dict() for vc in variant_codes]
    return [item.as_dict()]


def _infer_option_names(variants: list[dict]) -> list[str]:
    """Collect all unique attribute names from variants to define Shopify options."""
    seen: dict[str, None] = {}
    for v in variants:
        for attr in v.get("attributes", []):
            seen[attr["attribute"]] = None
    names = list(seen.keys())
    return names or ["Title"]


def _push_variants(
    client: ShopifyClient,
    product_gid: str,
    variants: list[dict],
    option_names: list[str],
    update: bool = False,
) -> int:
    if not variants:
        return 0

    bulk_input = []
    for v in variants:
        attr_map = {a["attribute"]: a["attribute_value"] for a in v.get("attributes", [])}
        option_values = (
            build_option_values_for_variant(attr_map, option_names)
            if option_names != ["Title"]
            else [{"optionName": "Title", "name": "Default Title"}]
        )
        variant_input = erpnext_variant_to_shopify_variant_input(v, option_values)

        # If updating, include the existing Shopify variant GID if known
        if update and v.get("shopify_variant_id"):
            variant_input["id"] = f"gid://shopify/ProductVariant/{v['shopify_variant_id']}"

        bulk_input.append(variant_input)

    mutation = _BULK_UPDATE_VARIANTS_MUTATION if update else _BULK_CREATE_VARIANTS_MUTATION
    key = "productVariantsBulkUpdate" if update else "productVariantsBulkCreate"

    data = client.mutate(
        mutation,
        {"productId": product_gid, "variants": bulk_input},
        user_errors_path=[key, "userErrors"],
    )

    created = data[key].get("productVariants") or []

    # Write variant IDs back
    if not update:
        for shopify_var in created:
            sku = shopify_var.get("sku", "")
            if not sku:
                continue
            variant_id = _strip_gid(shopify_var["id"])
            inventory_item_id = _strip_gid(shopify_var.get("inventoryItem", {}).get("id", ""))
            if frappe.db.exists("Item", sku):
                frappe.db.set_value("Item", sku, {
                    "shopify_variant_id": variant_id,
                    "shopify_inventory_item_id": inventory_item_id,
                }, update_modified=False)

    return len(created)
