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
            "fieldname": "cloudstore_category_id",
            "label": "Cloudstore Category ID",
            "fieldtype": "Data",
            "insert_after": "item_group_name",
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
