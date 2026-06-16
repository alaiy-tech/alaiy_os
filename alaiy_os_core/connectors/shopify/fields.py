import frappe

CUSTOM_FIELDS = [
    {
        "dt": "Item",
        "fieldname": "shopify_product_gid",
        "label": "Shopify Product GID",
        "fieldtype": "Data",
        "insert_after": "item_group",
    },
    {
        "dt": "Item",
        "fieldname": "shopify_variant_gid",
        "label": "Shopify Variant GID",
        "fieldtype": "Data",
        "insert_after": "shopify_product_gid",
    },
    {
        "dt": "Item",
        "fieldname": "shopify_inventory_item_gid",
        "label": "Shopify Inventory Item GID",
        "fieldtype": "Data",
        "insert_after": "shopify_variant_gid",
    },
    {
        "dt": "Item",
        "fieldname": "sync_to_shopify",
        "label": "Sync to Shopify",
        "fieldtype": "Check",
        "insert_after": "shopify_inventory_item_gid",
    },
    {
        "dt": "Customer",
        "fieldname": "shopify_customer_gid",
        "label": "Shopify Customer GID",
        "fieldtype": "Data",
        "insert_after": "customer_name",
    },
    {
        "dt": "Sales Order",
        "fieldname": "shopify_order_gid",
        "label": "Shopify Order GID",
        "fieldtype": "Data",
        "insert_after": "customer",
    },
    {
        "dt": "Sales Invoice",
        "fieldname": "shopify_order_gid",
        "label": "Shopify Order GID",
        "fieldtype": "Data",
        "insert_after": "customer",
    },
    {
        "dt": "Sales Invoice",
        "fieldname": "shopify_refund_gid",
        "label": "Shopify Refund GID",
        "fieldtype": "Data",
        "insert_after": "shopify_order_gid",
    },
    {
        "dt": "Delivery Note",
        "fieldname": "shopify_fulfillment_gid",
        "label": "Shopify Fulfillment GID",
        "fieldtype": "Data",
        "insert_after": "customer",
    },
]


def register_custom_fields() -> list:
    created = []
    for field in CUSTOM_FIELDS:
        if frappe.db.exists(
            "Custom Field", {"dt": field["dt"], "fieldname": field["fieldname"]}
        ):
            continue
        doc = frappe.get_doc({"doctype": "Custom Field", **field})
        doc.insert(ignore_permissions=True)
        created.append(f"{field['dt']}.{field['fieldname']}")
    if created:
        frappe.db.commit()
    return created
