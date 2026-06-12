"""
Media service: attach product images from ERPNext Item Website Image to Shopify.

Images are uploaded via the Shopify Files API using a URL (no binary upload).
ERPNext stores images as relative URLs; we prepend the site base URL.
"""

from __future__ import annotations
import frappe
from .client import ShopifyClient
from .mapper import _strip_gid


_CREATE_MEDIA_MUTATION = """
mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
  productCreateMedia(productId: $productId, media: $media) {
    media {
      ... on MediaImage {
        id
        status
        image { url }
      }
    }
    mediaUserErrors { field message }
    product { id }
  }
}
"""

_GET_PRODUCT_IMAGES_QUERY = """
query getProductImages($id: ID!) {
  product(id: $id) {
    media(first: 50) {
      edges {
        node {
          ... on MediaImage {
            id
            image { url altText }
          }
        }
      }
    }
  }
}
"""


def push_item_images(client: ShopifyClient, item_code: str, shopify_product_id: str) -> int:
    """
    Push images from an ERPNext Item to a Shopify product.
    Returns the number of images attached.
    """
    images = _collect_item_images(item_code)
    if not images:
        return 0

    product_gid = f"gid://shopify/Product/{shopify_product_id}"
    base_url = _get_site_base_url()

    media_inputs = []
    for img_url in images:
        if img_url.startswith("/"):
            img_url = base_url.rstrip("/") + img_url
        media_inputs.append({
            "originalSource": img_url,
            "mediaContentType": "IMAGE",
        })

    data = client.execute(
        _CREATE_MEDIA_MUTATION,
        {"productId": product_gid, "media": media_inputs},
    )

    errors = data.get("productCreateMedia", {}).get("mediaUserErrors", [])
    if errors:
        messages = [e.get("message", str(e)) for e in errors]
        frappe.log_error(
            f"Shopify media errors for {item_code}: {'; '.join(messages)}",
            "Shopify Media Push",
        )

    created = data.get("productCreateMedia", {}).get("media") or []
    return len(created)


def _collect_item_images(item_code: str) -> list[str]:
    """Collect all image URLs from an ERPNext Item and its variants."""
    images: list[str] = []

    # Template item image
    item = frappe.get_doc("Item", item_code)
    if item.image:
        images.append(item.image)
    if hasattr(item, "website_image") and item.website_image:
        images.append(item.website_image)

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique = []
    for img in images:
        if img not in seen:
            seen.add(img)
            unique.append(img)
    return unique


def _get_site_base_url() -> str:
    """Return the current Frappe site URL."""
    try:
        return frappe.utils.get_url()
    except Exception:
        return ""
