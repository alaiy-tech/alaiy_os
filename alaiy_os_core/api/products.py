"""
AlaiyOS Product Catalog API.

Backs the Product Catalog desk page (alaiy_os/page/product_catalog).
Exposes whitelisted endpoints to list, import and seed OS Product records.
"""

import json
import random

import frappe

PRODUCT_DOCTYPE = "OS Product"

PRODUCT_FIELDS = [
    "name",
    "sku",
    "product_name",
    "brand",
    "category",
    "supplier",
    "fulfillment",
    "cost",
    "sale_price",
    "retail_price",
    "inventory",
    "status",
]


@frappe.whitelist()
def get_products(status=None):
    """Return all OS Product rows for the catalog page, newest first.

    Optional `status` filters server-side (the page also filters client-side).
    """
    if not frappe.db.exists("DocType", PRODUCT_DOCTYPE):
        return []

    filters = {}
    if status:
        filters["status"] = status

    return frappe.get_all(
        PRODUCT_DOCTYPE,
        fields=PRODUCT_FIELDS,
        filters=filters,
        order_by="modified desc",
        limit_page_length=0,
    )


@frappe.whitelist()
def import_products(rows):
    """Bulk create/update OS Product records from a list of dicts.

    `rows` may be a JSON string (from the client) or a Python list.
    Rows are keyed on SKU — an existing SKU is updated, a new one is inserted.
    Returns a summary {created, updated, errors:[...]}.
    """
    if isinstance(rows, str):
        rows = json.loads(rows)

    created = 0
    updated = 0
    errors = []

    numeric = {"cost", "sale_price", "retail_price", "inventory"}

    for idx, raw in enumerate(rows):
        sku = (raw.get("sku") or "").strip()
        if not sku:
            errors.append(f"Row {idx + 1}: missing SKU — skipped")
            continue

        payload = {}
        for field in PRODUCT_FIELDS:
            if field in ("name",):
                continue
            if field not in raw:
                continue
            value = raw.get(field)
            if field in numeric:
                try:
                    value = float(value) if value not in (None, "") else 0
                except (TypeError, ValueError):
                    value = 0
                if field == "inventory":
                    value = int(value)
            payload[field] = value

        try:
            if frappe.db.exists(PRODUCT_DOCTYPE, sku):
                doc = frappe.get_doc(PRODUCT_DOCTYPE, sku)
                doc.update(payload)
                doc.save(ignore_permissions=True)
                updated += 1
            else:
                payload["doctype"] = PRODUCT_DOCTYPE
                payload["sku"] = sku
                frappe.get_doc(payload).insert(ignore_permissions=True)
                created += 1
        except Exception as e:
            errors.append(f"Row {idx + 1} ({sku}): {e}")

    frappe.db.commit()
    return {"created": created, "updated": updated, "errors": errors}


# ── Random demo data ────────────────────────────────────────────────────────

_BRANDS = ["Alto Moda", "Zephyr", "Nordwood", "Lumen", "Kite & Co", "Verano", "Halcyon", "Muse"]
_CATEGORIES = ["Apparel", "Footwear", "Accessories", "Home", "Beauty", "Outdoor", "Electronics"]
_ADJ = ["Classic", "Premium", "Essential", "Signature", "Everyday", "Limited", "Organic", "Slim"]
_NOUN = ["Tee", "Sneaker", "Jacket", "Backpack", "Watch", "Hoodie", "Mug", "Cap", "Wallet", "Scarf"]
_SUPPLIERS = ["Meridian Supply Co", "Bluewave Traders", "Crestline Wholesale", "Oakfield Goods", "Summit Distributors"]
_FULFILLMENT = ["In-house", "Dropship", "3PL", "Marketplace"]
_STATUS = ["Active", "Active", "Active", "Draft", "Out of Stock", "Discontinued"]


@frappe.whitelist()
def seed_products(count=40, purge=False):
    """Insert `count` random OS Product records (idempotent on SKU).

    Set purge=True to delete all existing OS Product rows first.
    Intended for demo/dev use — call via bench execute or the page button.
    """
    count = int(count)
    if isinstance(purge, str):
        purge = purge.lower() in ("1", "true", "yes")

    if purge:
        frappe.db.delete(PRODUCT_DOCTYPE)
        frappe.db.commit()

    made = 0
    for i in range(count):
        brand = random.choice(_BRANDS)
        name = f"{random.choice(_ADJ)} {random.choice(_NOUN)}"
        cost = round(random.uniform(4, 180), 2)
        sale = round(cost * random.uniform(1.3, 2.6), 2)
        retail = round(sale * random.uniform(1.05, 1.4), 2)
        status = random.choice(_STATUS)
        inv = 0 if status == "Out of Stock" else random.randint(0, 500)
        sku = f"{brand[:3].upper()}-{1000 + i}"

        if frappe.db.exists(PRODUCT_DOCTYPE, sku):
            continue

        frappe.get_doc({
            "doctype": PRODUCT_DOCTYPE,
            "sku": sku,
            "product_name": name,
            "brand": brand,
            "category": random.choice(_CATEGORIES),
            "supplier": random.choice(_SUPPLIERS),
            "fulfillment": random.choice(_FULFILLMENT),
            "cost": cost,
            "sale_price": sale,
            "retail_price": retail,
            "inventory": inv,
            "status": status,
        }).insert(ignore_permissions=True)
        made += 1

    frappe.db.commit()
    return {"seeded": made}
