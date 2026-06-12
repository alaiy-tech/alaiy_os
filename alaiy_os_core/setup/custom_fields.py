"""
Custom fields added to standard ERPNext DocTypes by Alaiy OS Core.

All fields are created via frappe's Custom Field mechanism — never by
editing native DocType JSON files.

Call create_custom_fields() once during app install (setup/install.py).
Running it again is safe — it skips fields that already exist.
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_field


CUSTOM_FIELDS = {
    "Item": [
        # ── Shopify fields ────────────────────────────────────────────────────
        {
            "fieldname": "shopify_push_enabled",
            "label": "Push to Shopify",
            "fieldtype": "Check",
            "insert_after": "item_code",
            "default": "0",
            "description": "When enabled, this item is included in Shopify sync jobs.",
        },
        {
            "fieldname": "shopify_product_id",
            "label": "Shopify Product ID",
            "fieldtype": "Data",
            "insert_after": "shopify_push_enabled",
            "read_only": 1,
            "no_copy": 1,
            "search_index": 1,
        },
        {
            "fieldname": "shopify_variant_id",
            "label": "Shopify Variant ID",
            "fieldtype": "Data",
            "insert_after": "shopify_product_id",
            "read_only": 1,
            "no_copy": 1,
            "search_index": 1,
        },
        {
            "fieldname": "shopify_inventory_item_id",
            "label": "Shopify Inventory Item ID",
            "fieldtype": "Data",
            "insert_after": "shopify_variant_id",
            "read_only": 1,
            "no_copy": 1,
        },
        {
            "fieldname": "shopify_product_handle",
            "label": "Shopify Product Handle",
            "fieldtype": "Data",
            "insert_after": "shopify_inventory_item_id",
            "read_only": 1,
            "no_copy": 1,
        },
        {
            "fieldname": "shopify_updated_at",
            "label": "Shopify Updated At",
            "fieldtype": "Data",
            "insert_after": "shopify_product_handle",
            "read_only": 1,
            "no_copy": 1,
        },
        {
            "fieldname": "shopify_status",
            "label": "Shopify Status",
            "fieldtype": "Select",
            "options": "\nACTIVE\nDRAFT\nARCHIVED",
            "insert_after": "shopify_updated_at",
            "read_only": 1,
            "no_copy": 1,
        },
        {
            "fieldname": "shopify_last_synced",
            "label": "Shopify Last Synced",
            "fieldtype": "Datetime",
            "insert_after": "shopify_status",
            "read_only": 1,
            "no_copy": 1,
        },
        {
            "fieldname": "shopify_vendor",
            "label": "Shopify Vendor",
            "fieldtype": "Data",
            "insert_after": "shopify_last_synced",
            "no_copy": 1,
        },
        {
            "fieldname": "shopify_product_type",
            "label": "Shopify Product Type",
            "fieldtype": "Data",
            "insert_after": "shopify_vendor",
            "no_copy": 1,
        },
        {
            "fieldname": "shopify_tags",
            "label": "Shopify Tags",
            "fieldtype": "Small Text",
            "insert_after": "shopify_product_type",
            "no_copy": 1,
            "description": "Comma-separated tags pushed to Shopify",
        },
        # ── Cloudstore fields ─────────────────────────────────────────────────
        {
            "fieldname": "cloudstore_id",
            "label": "Cloudstore ID",
            "fieldtype": "Data",
            "insert_after": "item_code",
            "read_only": 1,
            "no_copy": 1,
            "search_index": 1,
            "description": "MongoDB _id.$oid from The Corner / Cloudstore API",
        },
        {
            "fieldname": "cloudstore_sku",
            "label": "Cloudstore SKU",
            "fieldtype": "Data",
            "insert_after": "cloudstore_id",
            "read_only": 1,
            "no_copy": 1,
            "search_index": 1,
        },
        {
            "fieldname": "cloudstore_updated_at",
            "label": "Cloudstore Updated At",
            "fieldtype": "Data",
            "insert_after": "cloudstore_sku",
            "read_only": 1,
            "no_copy": 1,
        },
    ],
    "Item Group": [
        {
            "fieldname": "shopify_collection_id",
            "label": "Shopify Collection ID",
            "fieldtype": "Data",
            "insert_after": "item_group_name",
            "read_only": 1,
            "no_copy": 1,
            "search_index": 1,
        },
        {
            "fieldname": "cloudstore_category_id",
            "label": "Cloudstore Category ID",
            "fieldtype": "Data",
            "insert_after": "shopify_collection_id",
            "read_only": 1,
            "no_copy": 1,
            "search_index": 1,
        },
    ],
    "Purchase Order": [
        {
            "fieldname": "cloudstore_order_id",
            "label": "Cloudstore Order ID",
            "fieldtype": "Data",
            "insert_after": "supplier_name",
            "read_only": 1,
            "no_copy": 1,
        },
        {
            "fieldname": "cloudstore_order_status",
            "label": "Cloudstore Order Status",
            "fieldtype": "Data",
            "insert_after": "cloudstore_order_id",
            "read_only": 1,
            "no_copy": 1,
        },
        {
            "fieldname": "cloudstore_tracking_number",
            "label": "Cloudstore Tracking Number",
            "fieldtype": "Data",
            "insert_after": "cloudstore_order_status",
            "read_only": 1,
            "no_copy": 1,
        },
    ],
}


def create_custom_fields() -> None:
    """Idempotently create all Alaiy OS custom fields on standard DocTypes."""
    for doctype, fields in CUSTOM_FIELDS.items():
        for field_def in fields:
            if frappe.db.exists("Custom Field", {"dt": doctype, "fieldname": field_def["fieldname"]}):
                continue
            create_custom_field(doctype, field_def)
    frappe.db.commit()
