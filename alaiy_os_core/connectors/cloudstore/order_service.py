"""
Push ERPNext Purchase Orders to Cloudstore and pull order status updates back.
"""

from __future__ import annotations

import frappe
from alaiy_os_core.connectors.cloudstore.client import CloudstoreClient, CloudstoreAPIError
from alaiy_os_core.connectors.cloudstore.mapper import map_order_payload
from alaiy_os_core.connectors.cloudstore.constants import CF_CLOUDSTORE_ID, CF_CLOUDSTORE_SKU


def push_purchase_order(po_name: str, client: CloudstoreClient) -> dict:
    """
    Push a submitted ERPNext Purchase Order to Cloudstore.

    Stores the returned Cloudstore order ID in a custom field on the PO.
    Returns { "cloudstore_order_id": str } on success.
    """
    po = frappe.get_doc("Purchase Order", po_name)

    if po.docstatus != 1:
        frappe.throw(f"Purchase Order {po_name} must be submitted before pushing to Cloudstore.")

    items = []
    for row in po.items:
        sku_id = frappe.db.get_value("Item", row.item_code, CF_CLOUDSTORE_ID)
        sku_code = frappe.db.get_value("Item", row.item_code, CF_CLOUDSTORE_SKU)
        if not sku_id:
            frappe.throw(
                f"Item {row.item_code} has no cloudstore_id — cannot push to Cloudstore."
            )
        items.append({
            "sku_id": sku_id,
            "sku_code": sku_code,
            "qty": row.qty,
            "unit_price": row.rate,
        })

    payload_input = {
        "supplier_order_id": po_name,
        "items": items,
        "shipping_address": _get_shipping_address(po),
        "notes": po.get("remarks") or "",
    }

    payload = map_order_payload(payload_input)

    try:
        response = client.create_order(payload)
    except CloudstoreAPIError as exc:
        frappe.log_error(str(exc), f"Cloudstore order push failed for {po_name}")
        raise

    cloudstore_order_id = response.get("order_id") or response.get("id") or response.get("_id", {}).get("$oid")
    if cloudstore_order_id:
        frappe.db.set_value("Purchase Order", po_name, "cloudstore_order_id", cloudstore_order_id)

    return {"cloudstore_order_id": cloudstore_order_id}


def pull_order_status(po_name: str, client: CloudstoreClient) -> dict:
    """
    Fetch the latest status for an already-pushed Purchase Order from Cloudstore
    and update the ERPNext PO's custom status field.

    Returns { "status": str, "tracking_number": str | None }
    """
    cloudstore_order_id = frappe.db.get_value("Purchase Order", po_name, "cloudstore_order_id")
    if not cloudstore_order_id:
        frappe.throw(f"Purchase Order {po_name} has no cloudstore_order_id — push it first.")

    try:
        response = client.get_order(cloudstore_order_id)
    except CloudstoreAPIError as exc:
        frappe.log_error(str(exc), f"Cloudstore order fetch failed for {po_name}")
        raise

    status = response.get("status") or ""
    tracking = response.get("tracking_number") or response.get("tracking") or None

    update_vals: dict = {"cloudstore_order_status": status}
    if tracking:
        update_vals["cloudstore_tracking_number"] = tracking

    frappe.db.set_value("Purchase Order", po_name, update_vals)

    return {"status": status, "tracking_number": tracking}


def _get_shipping_address(po) -> dict:
    """Extract shipping address from the PO's linked address, if set."""
    if not po.get("shipping_address"):
        return {}
    try:
        addr = frappe.get_doc("Address", po.shipping_address)
        return {
            "line1": addr.address_line1 or "",
            "line2": addr.address_line2 or "",
            "city": addr.city or "",
            "state": addr.state or "",
            "pincode": addr.pincode or "",
            "country": addr.country or "",
        }
    except Exception:  # noqa: BLE001
        return {}
