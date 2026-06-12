"""
Publish service: set Shopify product sales channel visibility.

Publishes products to the Online Store channel by default.
"""

from __future__ import annotations
import frappe
from .client import ShopifyClient


_GET_PUBLICATIONS_QUERY = """
query {
  publications(first: 20) {
    edges {
      node {
        id
        name
        catalog {
          ... on AppCatalog {
            apps(first: 1) {
              edges { node { title } }
            }
          }
          ... on ChannelCatalog {
            channel { name }
          }
        }
      }
    }
  }
}
"""

_PUBLISH_MUTATION = """
mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    publishable {
      ... on Product {
        id
        publishedAt
      }
    }
    userErrors { field message }
  }
}
"""

_UNPUBLISH_MUTATION = """
mutation publishableUnpublish($id: ID!, $input: [PublicationInput!]!) {
  publishableUnpublish(id: $id, input: $input) {
    publishable {
      ... on Product {
        id
      }
    }
    userErrors { field message }
  }
}
"""


def get_online_store_publication_id(client: ShopifyClient) -> str | None:
    """
    Return the GID of the "Online Store" publication channel.
    Caches in the Alaiy OS Settings doc to avoid repeated API calls.
    """
    settings = frappe.get_single("Alaiy OS Settings")
    if getattr(settings, "shopify_online_store_publication_id", ""):
        return settings.shopify_online_store_publication_id

    data = client.execute(_GET_PUBLICATIONS_QUERY)
    for edge in data.get("publications", {}).get("edges", []):
        node = edge["node"]
        catalog = node.get("catalog") or {}
        channel = catalog.get("channel") or {}
        if channel.get("name") in ("Online Store", "online_store"):
            pub_id = node["id"]
            frappe.db.set_value("Alaiy OS Settings", None, "shopify_online_store_publication_id", pub_id)
            return pub_id

    return None


def publish_product(client: ShopifyClient, product_gid: str) -> None:
    """Publish a product to the Online Store channel."""
    pub_id = get_online_store_publication_id(client)
    if not pub_id:
        return

    client.mutate(
        _PUBLISH_MUTATION,
        {"id": product_gid, "input": [{"publicationId": pub_id}]},
        user_errors_path=["publishablePublish", "userErrors"],
    )


def unpublish_product(client: ShopifyClient, product_gid: str) -> None:
    """Remove a product from the Online Store channel."""
    pub_id = get_online_store_publication_id(client)
    if not pub_id:
        return

    client.mutate(
        _UNPUBLISH_MUTATION,
        {"id": product_gid, "input": [{"publicationId": pub_id}]},
        user_errors_path=["publishableUnpublish", "userErrors"],
    )
