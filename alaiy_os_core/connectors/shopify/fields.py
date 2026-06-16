import frappe

# Custom Fields the Shopify connector needs on ERPNext DocTypes.
# These are the cross-reference GIDs and the per-Item opt-in flag.
_FIELDS: list[dict] = [
    # ── Item ─────────────────────────────────────────────────────
    {
        "dt": "Item",
        "fieldname": "shopify_section",
        "label": "Shopify",
        "fieldtype": "Section Break",
        "insert_after": "item_group",
    },
    {
        "dt": "Item",
        "fieldname": "shopify_product_gid",
        "label": "Shopify Product GID",
        "fieldtype": "Data",
        "insert_after": "shopify_section",
        "read_only": 1,
    },
    {
        "dt": "Item",
        "fieldname": "shopify_variant_gid",
        "label": "Shopify Variant GID",
        "fieldtype": "Data",
        "insert_after": "shopify_product_gid",
        "read_only": 1,
    },
    {
        "dt": "Item",
        "fieldname": "shopify_inventory_item_gid",
        "label": "Shopify Inventory Item GID",
        "fieldtype": "Data",
        "insert_after": "shopify_variant_gid",
        "read_only": 1,
    },
    {
        "dt": "Item",
        "fieldname": "sync_to_shopify",
        "label": "Sync to Shopify",
        "fieldtype": "Check",
        "insert_after": "shopify_inventory_item_gid",
    },
    # ── Customer ─────────────────────────────────────────────────
    {
        "dt": "Customer",
        "fieldname": "shopify_customer_gid",
        "label": "Shopify Customer GID",
        "fieldtype": "Data",
        "insert_after": "customer_name",
        "read_only": 1,
    },
    # ── Sales Order ──────────────────────────────────────────────
    {
        "dt": "Sales Order",
        "fieldname": "shopify_order_gid",
        "label": "Shopify Order GID",
        "fieldtype": "Data",
        "insert_after": "customer",
        "read_only": 1,
    },
    # ── Sales Invoice ────────────────────────────────────────────
    {
        "dt": "Sales Invoice",
        "fieldname": "shopify_order_gid",
        "label": "Shopify Order GID",
        "fieldtype": "Data",
        "insert_after": "customer",
        "read_only": 1,
    },
    {
        "dt": "Sales Invoice",
        "fieldname": "shopify_refund_gid",
        "label": "Shopify Refund GID",
        "fieldtype": "Data",
        "insert_after": "shopify_order_gid",
        "read_only": 1,
    },
    # ── Delivery Note ────────────────────────────────────────────
    {
        "dt": "Delivery Note",
        "fieldname": "shopify_fulfillment_gid",
        "label": "Shopify Fulfillment GID",
        "fieldtype": "Data",
        "insert_after": "customer",
        "read_only": 1,
    },
]


def register_custom_fields() -> list[str]:
    """Idempotently create Shopify custom fields on ERPNext DocTypes.

    Returns the list of 'DocType.fieldname' strings that were newly created.
    """
    created: list[str] = []
    for field in _FIELDS:
        key = {"dt": field["dt"], "fieldname": field["fieldname"]}
        if frappe.db.exists("Custom Field", key):
            continue
        doc = frappe.get_doc({"doctype": "Custom Field", **field})
        doc.insert(ignore_permissions=True)
        created.append(f"{field['dt']}.{field['fieldname']}")
    return created
