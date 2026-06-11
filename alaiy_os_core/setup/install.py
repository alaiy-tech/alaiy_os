import frappe
from alaiy_os_core.config.loader import get_connector_settings, is_connector_enabled
from alaiy_os_core.setup.custom_fields import create_custom_fields


def after_install():
    """
    Called by Frappe after `bench install-app alaiy_os_core` and on every `bench migrate`.
    Registered in hooks.py as after_install and after_migrate.
    All operations are idempotent — safe to run multiple times.
    """
    frappe.logger().info("AlaiyOS: running setup")
    create_custom_fields()
    _setup_item_attributes()
    _setup_enabled_connectors()
    frappe.db.commit()
    frappe.logger().info("AlaiyOS: setup complete")


# ------------------------------------------------------------------ #
#  Item Attributes — always created, used by all connectors
# ------------------------------------------------------------------ #

def _setup_item_attributes():
    for attr_name in ["Size", "Color", "Season", "Brand"]:
        if not frappe.db.exists("Item Attribute", attr_name):
            doc = frappe.new_doc("Item Attribute")
            doc.attribute_name = attr_name
            doc.insert(ignore_permissions=True)
            frappe.logger().info(f"AlaiyOS: created Item Attribute '{attr_name}'")


# ------------------------------------------------------------------ #
#  Connector setup — only runs for enabled connectors
# ------------------------------------------------------------------ #

def _setup_enabled_connectors():
    if is_connector_enabled("cloudstore"):
        _setup_cloudstore()
    if is_connector_enabled("shopify"):
        _setup_shopify()


# ------------------------------------------------------------------ #
#  Cloudstore
# ------------------------------------------------------------------ #

def _setup_cloudstore():
    cfg = get_connector_settings("cloudstore")
    frappe.logger().info("AlaiyOS: setting up Cloudstore connector")

    supplier = _ensure_supplier(cfg["supplier_name"], cfg.get("supplier_country", ""))
    price_list = _ensure_price_list(
        cfg["price_list_name"], cfg["price_list_currency"], buying=True, selling=False
    )
    warehouse = _ensure_warehouse(cfg["warehouse_name"])

    _update_alaiy_os_settings({
        "cloudstore_api_url": cfg.get("api_url", ""),
        "cloudstore_api_token": cfg.get("api_token", ""),
        "cloudstore_supplier": supplier,
        "cloudstore_price_list": price_list,
        "cloudstore_default_warehouse": warehouse,
        "cloudstore_sync_enabled": 1,
        "cloudstore_page_size": cfg.get("page_size", 50),
    })
    frappe.logger().info("AlaiyOS: Cloudstore setup complete")


# ------------------------------------------------------------------ #
#  Shopify (stub — fill in when connector is built)
# ------------------------------------------------------------------ #

def _setup_shopify():
    cfg = get_connector_settings("shopify")
    frappe.logger().info("AlaiyOS: setting up Shopify connector")
    warehouse = _ensure_warehouse(cfg.get("warehouse_name", "Shopify Warehouse"))
    _update_alaiy_os_settings({
        "shopify_shop_url": cfg.get("shop_url", ""),
        "shopify_access_token": cfg.get("access_token", ""),
        "shopify_default_warehouse": warehouse,
        "shopify_sync_enabled": 1,
    })


# ------------------------------------------------------------------ #
#  Shared helpers — all idempotent
# ------------------------------------------------------------------ #

def _ensure_supplier(name: str, country: str = "") -> str:
    if frappe.db.exists("Supplier", name):
        return name
    doc = frappe.new_doc("Supplier")
    doc.supplier_name = name
    doc.supplier_group = "Supplier"
    doc.country = country
    doc.insert(ignore_permissions=True)
    frappe.logger().info(f"AlaiyOS: created Supplier '{name}'")
    return name


def _ensure_price_list(name: str, currency: str, buying: bool, selling: bool) -> str:
    if frappe.db.exists("Price List", name):
        return name
    doc = frappe.new_doc("Price List")
    doc.price_list_name = name
    doc.currency = currency
    doc.buying = 1 if buying else 0
    doc.selling = 1 if selling else 0
    doc.enabled = 1
    doc.insert(ignore_permissions=True)
    frappe.logger().info(f"AlaiyOS: created Price List '{name}'")
    return name


def _ensure_warehouse(name: str) -> str:
    """
    Return the warehouse name if it exists; create it under the default company if not.
    ERPNext stores warehouses as "Name - Company Abbr".
    """
    if frappe.db.exists("Warehouse", name):
        return name

    company = frappe.db.get_single_value("Global Defaults", "default_company")
    if not company:
        companies = frappe.get_all("Company", limit=1)
        company = companies[0].name if companies else None

    if company:
        abbr = frappe.db.get_value("Company", company, "abbr")
        full_name = f"{name} - {abbr}"
        if frappe.db.exists("Warehouse", full_name):
            return full_name
        doc = frappe.new_doc("Warehouse")
        doc.warehouse_name = name
        doc.company = company
        doc.insert(ignore_permissions=True)
        frappe.logger().info(f"AlaiyOS: created Warehouse '{doc.name}'")
        return doc.name

    existing = frappe.get_all("Warehouse", limit=1)
    if existing:
        return existing[0].name
    frappe.logger().warning("AlaiyOS: no warehouse found or created")
    return ""


def _update_alaiy_os_settings(values: dict):
    """
    Write values into Alaiy OS Settings.
    - Skips fields that don't exist on the DocType.
    - For sensitive fields (tokens), never overwrites a value already set.
    - For non-sensitive fields (urls, refs, flags), always overwrites.
    """
    non_sensitive = {
        "cloudstore_api_url", "cloudstore_page_size", "cloudstore_default_warehouse",
        "cloudstore_price_list", "cloudstore_supplier", "cloudstore_sync_enabled",
        "shopify_shop_url", "shopify_default_warehouse", "shopify_sync_enabled",
    }

    settings = frappe.get_single("Alaiy OS Settings")
    changed = False

    for fieldname, value in values.items():
        if not frappe.db.exists("DocField", {"parent": "Alaiy OS Settings", "fieldname": fieldname}):
            frappe.logger().warning(f"AlaiyOS: field '{fieldname}' not found on Alaiy OS Settings — skipping")
            continue
        current = getattr(settings, fieldname, None)
        if current and fieldname not in non_sensitive:
            continue
        setattr(settings, fieldname, value)
        changed = True

    if changed:
        settings.save(ignore_permissions=True)
        frappe.logger().info("AlaiyOS: Alaiy OS Settings updated")
