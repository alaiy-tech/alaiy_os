"""
AlaiyOS install + migrate hook.
Registered in hooks.py as after_install and after_migrate.
Safe to re-run — all helpers are idempotent.
"""

import frappe

from alaiy_os_core.setup.custom_fields import create_custom_fields


def after_install():
    _setup_warehouse_types()
    create_custom_fields()
    _setup_item_attributes()
    frappe.logger().info("AlaiyOS: install complete — finish setup via the web UI")
    frappe.db.commit()


def _setup_warehouse_types():
    for wt in ["Finished Goods", "Work In Progress", "All",
               "Goods In Transit", "Transit", "Stores", "Return"]:
        if not frappe.db.exists("Warehouse Type", wt):
            doc = frappe.new_doc("Warehouse Type")
            doc.name = wt
            doc.insert(ignore_permissions=True)


def after_migrate():
    create_custom_fields()
    _setup_item_attributes()
    frappe.db.commit()


def _setup_item_attributes():
    for attr_name in ["Size", "Color", "Season", "Brand"]:
        if not frappe.db.exists("Item Attribute", attr_name):
            doc = frappe.new_doc("Item Attribute")
            doc.attribute_name = attr_name
            doc.insert(ignore_permissions=True)
