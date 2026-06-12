"""
Collection service: map ERPNext Item Groups to Shopify Collections.

Uses Manual (custom) collections. Smart collections are not created here.
"""

from __future__ import annotations
import frappe
from .client import ShopifyClient
from .mapper import _strip_gid


_CREATE_COLLECTION_MUTATION = """
mutation collectionCreate($input: CollectionInput!) {
  collectionCreate(input: $input) {
    collection {
      id
      title
      handle
    }
    userErrors { field message }
  }
}
"""

_UPDATE_COLLECTION_MUTATION = """
mutation collectionUpdate($input: CollectionInput!) {
  collectionUpdate(input: $input) {
    collection {
      id
      title
    }
    userErrors { field message }
  }
}
"""

_ADD_PRODUCTS_MUTATION = """
mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
  collectionAddProducts(id: $id, productIds: $productIds) {
    collection { id }
    userErrors { field message }
  }
}
"""

_LIST_COLLECTIONS_QUERY = """
query listCollections($first: Int!, $after: String) {
  collections(first: $first, after: $after) {
    edges {
      node {
        id
        title
        handle
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
"""


def ensure_collection_for_item_group(client: ShopifyClient, item_group_name: str) -> str:
    """
    Get or create a Shopify collection for an ERPNext Item Group.
    Returns the Shopify collection GID.
    """
    # Check if we already have the ID stored
    existing_id = frappe.db.get_value("Item Group", item_group_name, "shopify_collection_id")
    if existing_id:
        return f"gid://shopify/Collection/{existing_id}"

    # Create it
    data = client.mutate(
        _CREATE_COLLECTION_MUTATION,
        {"input": {"title": item_group_name}},
        user_errors_path=["collectionCreate", "userErrors"],
    )
    collection = data["collectionCreate"]["collection"]
    collection_id = _strip_gid(collection["id"])

    frappe.db.set_value("Item Group", item_group_name, "shopify_collection_id", collection_id, update_modified=False)
    return collection["id"]


def add_product_to_collection(client: ShopifyClient, collection_gid: str, product_gid: str) -> None:
    """Add a product to a collection. Idempotent — Shopify ignores duplicate adds."""
    client.mutate(
        _ADD_PRODUCTS_MUTATION,
        {"id": collection_gid, "productIds": [product_gid]},
        user_errors_path=["collectionAddProducts", "userErrors"],
    )


def sync_item_group_collections(client: ShopifyClient) -> int:
    """
    Ensure all non-root Item Groups have a matching Shopify collection.
    Returns the number of collections created/verified.
    """
    groups = frappe.get_all(
        "Item Group",
        filters={"is_group": 0, "name": ["not in", ["All Item Groups", "Products"]]},
        pluck="name",
    )
    count = 0
    for group in groups:
        ensure_collection_for_item_group(client, group)
        count += 1
    return count
