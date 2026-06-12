"""
Metafield service: sync arbitrary ERPNext fields to Shopify product metafields.

The Shopify Metafield Map DocType defines the mapping:
  erpnext_doctype + erpnext_fieldname → shopify namespace + key + type.
"""

from __future__ import annotations
import frappe
from .client import ShopifyClient
from .constants import METAFIELD_NAMESPACE
from .mapper import _strip_gid


_SET_METAFIELDS_MUTATION = """
mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields {
      id
      namespace
      key
    }
    userErrors { field message }
  }
}
"""

_DELETE_METAFIELDS_MUTATION = """
mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
  metafieldsDelete(metafields: $metafields) {
    deletedMetafields { namespace key }
    userErrors { field message }
  }
}
"""


def push_item_metafields(client: ShopifyClient, item_code: str, shopify_product_gid: str) -> int:
    """
    Push metafields for an ERPNext Item to a Shopify product.
    Reads mapping rules from Shopify Metafield Map DocType.
    Returns number of metafields set.
    """
    mappings = _get_mappings("Item")
    if not mappings:
        return 0

    item = frappe.get_doc("Item", item_code)
    metafield_inputs = []

    for mapping in mappings:
        value = item.get(mapping.erpnext_fieldname)
        if value is None or value == "":
            continue

        metafield_inputs.append({
            "ownerId": shopify_product_gid,
            "namespace": mapping.shopify_namespace or METAFIELD_NAMESPACE,
            "key": mapping.shopify_key,
            "value": str(value),
            "type": mapping.shopify_type or "single_line_text_field",
        })

    if not metafield_inputs:
        return 0

    data = client.mutate(
        _SET_METAFIELDS_MUTATION,
        {"metafields": metafield_inputs},
        user_errors_path=["metafieldsSet", "userErrors"],
    )
    created = data.get("metafieldsSet", {}).get("metafields") or []
    return len(created)


def _get_mappings(doctype: str) -> list:
    """Return Shopify Metafield Map rows for a given ERPNext doctype."""
    return frappe.get_all(
        "Shopify Metafield Map",
        filters={"erpnext_doctype": doctype, "enabled": 1},
        fields=["erpnext_fieldname", "shopify_namespace", "shopify_key", "shopify_type"],
    )
