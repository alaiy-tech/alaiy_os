"""
Sync Cloudstore products → ERPNext Items.

Rules enforced here:
- Template Item saved FIRST, then each variant, then prices — FK order required by ERPNext.
- Single doc.save() per Item after ALL field mutations (including _upsert_supplier_ref).
- Active attributes derived from the variant set that was actually fetched, not the
  template-level attributes array (which may be stale or incomplete).
- Custom fields (cloudstore_id, cloudstore_sku, cloudstore_updated_at) written directly;
  they must exist before this runs (setup/custom_fields.py creates them).
"""

from __future__ import annotations

import frappe
from alaiy_os_core.connectors.cloudstore.client import CloudstoreClient, CloudstoreAPIError
from alaiy_os_core.connectors.cloudstore.mapper import map_product_template, map_variant
from alaiy_os_core.connectors.cloudstore.constants import (
    DEFAULT_PAGE_SIZE,
    CF_CLOUDSTORE_ID,
    CF_CLOUDSTORE_SKU,
    CF_CLOUDSTORE_UPDATED_AT,
)


def sync_full_catalog(
    client: CloudstoreClient,
    supplier: str,
    price_list: str,
    warehouse: str,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict:
    """
    Page through the entire Cloudstore catalog and upsert all products.

    Returns { "fetched": int, "created": int, "updated": int, "skipped": int, "errors": list[str] }
    """
    result: dict = {"fetched": 0, "created": 0, "updated": 0, "skipped": 0, "errors": []}
    page = 1

    while True:
        try:
            resp = client.get_products(page=page, page_size=page_size)
        except CloudstoreAPIError as exc:
            frappe.log_error(str(exc), "Cloudstore catalog fetch failed")
            result["errors"].append(str(exc))
            break

        products = resp.get("data") or []
        if not products:
            break

        result["fetched"] += len(products)

        for raw_product in products:
            try:
                _upsert_product(raw_product, client, supplier, price_list, warehouse, result)
            except Exception as exc:  # noqa: BLE001
                pid = raw_product.get("_id", {}).get("$oid") or raw_product.get("id") or "?"
                msg = f"Product {pid} upsert failed: {exc}"
                frappe.log_error(msg, "Cloudstore product sync error")
                result["errors"].append(msg)
                result["skipped"] += 1

        total = resp.get("total") or 0
        if page * page_size >= total:
            break
        page += 1

    return result


def sync_stock_updates(client: CloudstoreClient, since_event_id: str | None = None) -> dict:
    """
    Pull incremental events and apply stock changes to ERPNext bin via warehouse entry.

    Returns { "events_processed": int, "last_event_id": str | None, "errors": list[str] }
    """
    from alaiy_os_core.connectors.cloudstore.mapper import map_stock_update

    result: dict = {"events_processed": 0, "last_event_id": since_event_id, "errors": []}

    try:
        resp = client.get_events(since_event_id=since_event_id)
    except CloudstoreAPIError as exc:
        frappe.log_error(str(exc), "Cloudstore event fetch failed")
        result["errors"].append(str(exc))
        return result

    events = resp.get("data") or []
    result["last_event_id"] = resp.get("last_event_id") or since_event_id

    for event in events:
        try:
            stock = map_stock_update(event.get("payload") or event)
            _apply_stock_update(stock["sku_id"], stock["quantity"])
            result["events_processed"] += 1
        except Exception as exc:  # noqa: BLE001
            msg = f"Stock event processing failed: {exc}"
            frappe.log_error(msg, "Cloudstore stock update error")
            result["errors"].append(msg)

    return result


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------

def _upsert_product(
    raw_product: dict,
    client: CloudstoreClient,
    supplier: str,
    price_list: str,
    warehouse: str,
    result: dict,
) -> None:
    template_data = map_product_template(raw_product)
    cloudstore_id = template_data["cloudstore_id"]
    if not cloudstore_id:
        result["skipped"] += 1
        return

    template_item_code = f"CS-{cloudstore_id}"

    # Fetch variants before touching ERPNext so we know the attribute set
    try:
        raw_variants = client.get_product_variants(cloudstore_id)
    except CloudstoreAPIError as exc:
        frappe.log_error(str(exc), f"Cloudstore variants fetch failed for {cloudstore_id}")
        raise

    mapped_variants = [map_variant(v, template_item_code) for v in raw_variants]

    # Derive the active attribute names from the actual variant set
    active_attributes: list[str] = _active_attributes(mapped_variants)

    # ---- 1. Upsert template Item ----
    template_is_new = not frappe.db.exists("Item", template_item_code)

    if template_is_new:
        tpl = frappe.new_doc("Item")
        tpl.item_code = template_item_code
    else:
        tpl = frappe.get_doc("Item", template_item_code)

    tpl.item_name = template_data["item_name"] or template_item_code
    tpl.item_group = _resolve_item_group(template_data["item_group"])
    tpl.description = template_data["description"]
    tpl.brand = template_data["brand"] or ""
    tpl.has_variants = 1
    tpl.is_stock_item = 1
    tpl.stock_uom = "Nos"
    tpl.set(CF_CLOUDSTORE_ID, cloudstore_id)
    tpl.set(CF_CLOUDSTORE_UPDATED_AT, template_data["cloudstore_updated_at"])

    # Attribute rows — rebuild from active attribute list
    tpl.set("attributes", [])
    for attr_name in active_attributes:
        _ensure_item_attribute(attr_name)
        tpl.append("attributes", {"attribute": attr_name})

    # Supplier ref in Item Supplier child table
    _upsert_supplier_ref(tpl, supplier)

    # Single save for the template
    if template_is_new:
        tpl.insert(ignore_permissions=True)
        result["created"] += 1
    else:
        tpl.save(ignore_permissions=True)
        result["updated"] += 1

    # ---- 2. Upsert each variant ----
    for variant_data in mapped_variants:
        _upsert_variant(variant_data, price_list, result)


def _upsert_variant(variant_data: dict, price_list: str, result: dict) -> None:
    item_code = variant_data["item_code"]
    is_new = not frappe.db.exists("Item", item_code)

    if is_new:
        doc = frappe.new_doc("Item")
        doc.item_code = item_code
    else:
        doc = frappe.get_doc("Item", item_code)

    doc.item_name = item_code
    doc.variant_of = variant_data["variant_of"]
    doc.has_variants = 0
    doc.is_stock_item = 1
    doc.stock_uom = "Nos"
    doc.set(CF_CLOUDSTORE_ID, variant_data["cloudstore_id"])
    doc.set(CF_CLOUDSTORE_SKU, variant_data["cloudstore_sku"])

    if variant_data.get("weight_per_unit") is not None:
        doc.weight_per_unit = variant_data["weight_per_unit"]
        doc.weight_uom = "Kg"

    # Attribute values for this variant
    doc.set("attributes", [])
    for attr in variant_data["attributes"]:
        _ensure_item_attribute_value(attr["attribute"], attr["attribute_value"])
        doc.append("attributes", {
            "attribute": attr["attribute"],
            "attribute_value": attr["attribute_value"],
        })

    # Single save for the variant
    if is_new:
        doc.insert(ignore_permissions=True)
    else:
        doc.save(ignore_permissions=True)

    # ---- 3. Upsert Item Price ----
    if variant_data["standard_rate"] and price_list:
        _upsert_item_price(item_code, variant_data["standard_rate"], price_list)


def _upsert_supplier_ref(doc, supplier: str) -> None:
    """Mutate doc's supplier_items child table in memory. Caller does the save."""
    if not supplier:
        return
    for row in doc.get("supplier_items") or []:
        if row.supplier == supplier:
            return
    doc.append("supplier_items", {"supplier": supplier})


def _upsert_item_price(item_code: str, rate: float, price_list: str) -> None:
    existing = frappe.db.get_value(
        "Item Price",
        {"item_code": item_code, "price_list": price_list},
        "name",
    )
    if existing:
        frappe.db.set_value("Item Price", existing, "price_list_rate", rate)
    else:
        doc = frappe.new_doc("Item Price")
        doc.item_code = item_code
        doc.price_list = price_list
        doc.price_list_rate = rate
        doc.insert(ignore_permissions=True)


def _apply_stock_update(sku_id: str, quantity: int) -> None:
    """
    Post a Stock Reconciliation entry for the given SKU.

    Looks up the Item by cloudstore_id custom field, then posts via
    frappe.get_doc("Stock Reconciliation") so ERPNext validates bin logic.
    """
    item_code = frappe.db.get_value("Item", {CF_CLOUDSTORE_ID: sku_id}, "item_code")
    if not item_code:
        return

    settings = frappe.get_single("Alaiy OS Settings")
    warehouse = settings.cloudstore_default_warehouse
    if not warehouse:
        return

    sr = frappe.new_doc("Stock Reconciliation")
    sr.purpose = "Stock Reconciliation"
    sr.append("items", {
        "item_code": item_code,
        "warehouse": warehouse,
        "qty": quantity,
    })
    sr.insert(ignore_permissions=True)
    sr.submit()


def _active_attributes(mapped_variants: list[dict]) -> list[str]:
    """Return ordered list of attribute names present in at least one variant."""
    seen: dict[str, int] = {}
    for v in mapped_variants:
        for attr in v.get("attributes") or []:
            name = attr["attribute"]
            if name not in seen:
                seen[name] = len(seen)
    return sorted(seen.keys(), key=lambda k: seen[k])


def _resolve_item_group(group_name: str) -> str:
    """Return the Item Group name if it exists in ERPNext, else fall back to 'Products'."""
    if group_name and frappe.db.exists("Item Group", group_name):
        return group_name
    return "Products"


def _ensure_item_attribute(attr_name: str) -> None:
    """Create an Item Attribute record if it doesn't exist yet."""
    if not frappe.db.exists("Item Attribute", attr_name):
        doc = frappe.new_doc("Item Attribute")
        doc.attribute_name = attr_name
        doc.insert(ignore_permissions=True)


def _ensure_item_attribute_value(attr_name: str, value: str) -> None:
    """Append a value to an Item Attribute's value table if not present."""
    _ensure_item_attribute(attr_name)
    doc = frappe.get_doc("Item Attribute", attr_name)
    existing_values = {row.attribute_value for row in doc.item_attribute_values}
    if value not in existing_values:
        doc.append("item_attribute_values", {
            "attribute_value": value,
            "abbr": value[:3].upper(),
        })
        doc.save(ignore_permissions=True)
