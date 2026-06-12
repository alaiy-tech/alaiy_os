"""
Inventory service: push ERPNext bin quantities to Shopify inventory levels.

Shopify inventory is location-based. We maintain a mapping of
ERPNext Warehouse ↔ Shopify Location in the "Shopify Location" DocType.
"""

from __future__ import annotations
import frappe
from .client import ShopifyClient
from .mapper import _strip_gid


_GET_LOCATIONS_QUERY = """
query {
  locations(first: 50) {
    edges {
      node {
        id
        name
        isActive
        fulfillsOnlineOrders
      }
    }
  }
}
"""

_INVENTORY_SET_MUTATION = """
mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
  inventorySetQuantities(input: $input) {
    inventoryAdjustmentGroup {
      reason
      changes { name delta }
    }
    userErrors { field message }
  }
}
"""

_INVENTORY_ACTIVATE_MUTATION = """
mutation inventoryActivate($inventoryItemId: ID!, $locationId: ID!) {
  inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId) {
    inventoryLevel {
      id
      available
    }
    userErrors { field message }
  }
}
"""


def sync_locations(client: ShopifyClient) -> list[dict]:
    """
    Pull Shopify locations and upsert into the Shopify Location DocType.
    Returns list of location records.
    """
    data = client.execute(_GET_LOCATIONS_QUERY)
    locations = []
    for edge in data.get("locations", {}).get("edges", []):
        node = edge["node"]
        location_id = _strip_gid(node["id"])
        name = node["name"]
        active = node.get("isActive", False)

        if not frappe.db.exists("Shopify Location", location_id):
            doc = frappe.new_doc("Shopify Location")
            doc.shopify_location_id = location_id
            doc.location_name = name
            doc.is_active = 1 if active else 0
            doc.insert(ignore_permissions=True)
        else:
            frappe.db.set_value("Shopify Location", location_id, {
                "location_name": name,
                "is_active": 1 if active else 0,
            })

        locations.append({"id": location_id, "name": name, "active": active})

    frappe.db.commit()
    return locations


def get_default_location_id(client: ShopifyClient) -> str | None:
    """Return the Shopify Location GID for the first active location."""
    # Try from stored locations first
    stored = frappe.get_all(
        "Shopify Location",
        filters={"is_active": 1},
        order_by="creation asc",
        limit=1,
        pluck="shopify_location_id",
    )
    if stored:
        return f"gid://shopify/Location/{stored[0]}"

    # Fall back to API
    locations = sync_locations(client)
    active = [l for l in locations if l["active"]]
    return f"gid://shopify/Location/{active[0]['id']}" if active else None


def push_inventory(
    client: ShopifyClient,
    inventory_item_gid: str,
    location_gid: str,
    quantity: int,
) -> None:
    """
    Set inventory quantity for a single item at a single location.
    Activates the inventory item at the location first if needed.
    """
    # Activate first (idempotent)
    try:
        client.mutate(
            _INVENTORY_ACTIVATE_MUTATION,
            {"inventoryItemId": inventory_item_gid, "locationId": location_gid},
            user_errors_path=["inventoryActivate", "userErrors"],
        )
    except Exception:
        pass  # May already be active

    client.mutate(
        _INVENTORY_SET_MUTATION,
        {
            "input": {
                "reason": "correction",
                "referenceDocumentUri": "alaiy-os://inventory-sync",
                "quantities": [
                    {
                        "inventoryItemId": inventory_item_gid,
                        "locationId": location_gid,
                        "quantity": max(0, quantity),
                        "name": "available",
                    }
                ],
            }
        },
        user_errors_path=["inventorySetQuantities", "userErrors"],
    )


def push_all_inventory(client: ShopifyClient) -> dict:
    """
    Push inventory quantities for all items that have a shopify_inventory_item_id.
    Uses the warehouse→location mapping in Shopify Location DocType.
    """
    location_gid = get_default_location_id(client)
    if not location_gid:
        return {"ok": False, "error": "No active Shopify location found"}

    items = frappe.get_all(
        "Item",
        filters={"shopify_inventory_item_id": ["!=", ""]},
        fields=["name", "shopify_inventory_item_id"],
    )

    pushed = 0
    errors = []

    for item in items:
        try:
            # Get actual_qty from Bin (sum across all warehouses for simplicity)
            total_qty = frappe.db.sql(
                "SELECT COALESCE(SUM(actual_qty), 0) FROM `tabBin` WHERE item_code = %s",
                item["name"],
            )[0][0]
            inventory_item_gid = f"gid://shopify/InventoryItem/{item['shopify_inventory_item_id']}"
            push_inventory(client, inventory_item_gid, location_gid, int(total_qty))
            pushed += 1
        except Exception as e:
            errors.append({"item": item["name"], "error": str(e)})

    return {"pushed": pushed, "errors": errors}
