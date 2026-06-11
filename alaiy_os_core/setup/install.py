"""
AlaiyOS install + migrate hook.
Registered in hooks.py as after_install and after_migrate.
Safe to re-run — all helpers are idempotent.
"""

import frappe

from alaiy_os_core.config.loader import get_connector_settings, is_connector_enabled
from alaiy_os_core.setup.custom_fields import create_custom_fields


def after_install():
    """
    Called once by Frappe on `bench install-app alaiy_os_core`.
    Hard-aborts if .env is incomplete — nothing is written to the DB.
    """
    from alaiy_os_core.config.env import validate
    try:
        validate()
    except EnvironmentError as e:
        print(str(e))
        raise SystemExit(1)

    _run_setup()


def after_migrate():
    """
    Called on every `bench migrate`.
    Warns and skips setup if .env is incomplete — never blocks the migration.
    Also health-checks connector credentials after setup.
    """
    from alaiy_os_core.config.env import validate
    try:
        validate()
    except EnvironmentError:
        frappe.logger().warning(
            "AlaiyOS: .env incomplete — skipping setup during migrate. "
            "Fix .env then run: bench execute alaiy_os_core.setup.install.after_install"
        )
        return

    _run_setup()
    verify_connector_credentials()


def _run_setup():
    """Shared setup body — called by both after_install and after_migrate."""
    from alaiy_os_core.setup.erpnext_setup import setup_erpnext
    setup_erpnext()

    frappe.logger().info("AlaiyOS: running connector setup")
    create_custom_fields()
    _setup_item_attributes()
    _setup_enabled_connectors()

    frappe.db.commit()
    frappe.logger().info("AlaiyOS: setup complete")


# ── Credential health checks ──────────────────────────────────────────────────

def verify_connector_credentials():
    """
    For each enabled connector, makes a real API call to confirm credentials work.
    Logs a warning if they don't — never raises, never aborts.
    """
    if is_connector_enabled("cloudstore"):
        _verify_cloudstore()
    if is_connector_enabled("shopify"):
        _verify_shopify()


def _verify_cloudstore():
    try:
        from alaiy_os_core.connectors.cloudstore.client import CloudstoreClient
        result = CloudstoreClient().health_check()
        if result["ok"]:
            frappe.logger().info("AlaiyOS: Cloudstore credentials ✓ valid")
        else:
            frappe.logger().warning(
                f"AlaiyOS: Cloudstore credentials INVALID — {result['error']}\n"
                f"Check CLOUDSTORE_API_URL and CLOUDSTORE_API_TOKEN in .env"
            )
    except Exception as e:  # noqa: BLE001
        frappe.logger().warning(f"AlaiyOS: Cloudstore health check failed — {e}")


def _verify_shopify():
    # Stub — implement when Shopify client is built
    frappe.logger().info("AlaiyOS: Shopify health check not yet implemented")


# ── Item Attributes ───────────────────────────────────────────────────────────

def _setup_item_attributes():
    for attr_name in ["Size", "Color", "Season", "Brand"]:
        if not frappe.db.exists("Item Attribute", attr_name):
            doc = frappe.new_doc("Item Attribute")
            doc.attribute_name = attr_name
            doc.insert(ignore_permissions=True)
            frappe.logger().info(f"AlaiyOS: created Item Attribute '{attr_name}'")


# ── Connector dispatch ────────────────────────────────────────────────────────

def _setup_enabled_connectors():
    if is_connector_enabled("cloudstore"):
        _setup_cloudstore()
    if is_connector_enabled("shopify"):
        _setup_shopify()


# ── Cloudstore ────────────────────────────────────────────────────────────────

def _setup_cloudstore():
    cfg = get_connector_settings("cloudstore")
    frappe.logger().info("AlaiyOS: setting up Cloudstore connector")

    supplier   = _ensure_supplier(cfg["supplier_name"], cfg["supplier_country"])
    price_list = _ensure_price_list(
        cfg["price_list_name"], cfg["price_list_currency"], buying=True, selling=False
    )
    warehouse  = _ensure_warehouse(cfg["warehouse_name"])

    _update_alaiy_os_settings({
        "cloudstore_api_url":           cfg["api_url"],
        "cloudstore_supplier":          supplier,
        "cloudstore_price_list":        price_list,
        "cloudstore_default_warehouse": warehouse,
        "cloudstore_sync_enabled":      1,
        "cloudstore_page_size":         cfg["page_size"],
        # NOTE: cloudstore_api_token intentionally not set here — read from .env at runtime
    })
    frappe.logger().info("AlaiyOS: Cloudstore setup complete")


# ── Shopify (stub — fill in when connector is built) ─────────────────────────

def _setup_shopify():
    cfg = get_connector_settings("shopify")
    frappe.logger().info("AlaiyOS: setting up Shopify connector")
    warehouse = _ensure_warehouse(cfg.get("warehouse_name", "Shopify Warehouse"))
    _update_alaiy_os_settings({
        "shopify_shop_url":          cfg.get("shop_url", ""),
        "shopify_default_warehouse": warehouse,
        "shopify_sync_enabled":      1,
    })


# ── Shared helpers ────────────────────────────────────────────────────────────

def _ensure_supplier(name: str, country: str = "") -> str:
    if frappe.db.exists("Supplier", name):
        return name
    if not frappe.db.exists("Supplier Group", "All Supplier Groups"):
        sg = frappe.new_doc("Supplier Group")
        sg.supplier_group_name = "All Supplier Groups"
        sg.is_group = 1
        sg.insert(ignore_permissions=True)
    doc = frappe.new_doc("Supplier")
    doc.supplier_name  = name
    doc.supplier_group = "All Supplier Groups"
    doc.country        = country
    doc.insert(ignore_permissions=True)
    frappe.logger().info(f"AlaiyOS: created Supplier '{name}'")
    return name


def _ensure_price_list(name: str, currency: str, buying: bool, selling: bool) -> str:
    if frappe.db.exists("Price List", name):
        return name
    doc = frappe.new_doc("Price List")
    doc.price_list_name = name
    doc.currency        = currency
    doc.buying          = 1 if buying else 0
    doc.selling         = 1 if selling else 0
    doc.enabled         = 1
    doc.insert(ignore_permissions=True)
    frappe.logger().info(f"AlaiyOS: created Price List '{name}'")
    return name


def _ensure_warehouse(name: str) -> str:
    if frappe.db.exists("Warehouse", name):
        return name
    company = frappe.db.get_single_value("Global Defaults", "default_company")
    if company:
        abbr      = frappe.db.get_value("Company", company, "abbr")
        full_name = f"{name} - {abbr}"
        if frappe.db.exists("Warehouse", full_name):
            return full_name
        doc = frappe.new_doc("Warehouse")
        doc.warehouse_name = name
        doc.company        = company
        doc.insert(ignore_permissions=True)
        frappe.logger().info(f"AlaiyOS: created Warehouse '{doc.name}'")
        return doc.name
    existing = frappe.get_all("Warehouse", limit=1, pluck="name")
    if existing:
        return existing[0]
    frappe.logger().warning("AlaiyOS: no warehouse found or created")
    return ""


def _update_alaiy_os_settings(values: dict):
    """
    Write values into Alaiy OS Settings.
    Non-sensitive config fields are always overwritten.
    Sensitive fields (tokens) are never touched by this function.
    """
    always_overwrite = {
        "cloudstore_api_url",
        "cloudstore_page_size",
        "cloudstore_default_warehouse",
        "cloudstore_price_list",
        "cloudstore_supplier",
        "cloudstore_sync_enabled",
        "shopify_shop_url",
        "shopify_default_warehouse",
        "shopify_sync_enabled",
    }

    settings = frappe.get_single("Alaiy OS Settings")
    changed  = False

    for fieldname, value in values.items():
        current = getattr(settings, fieldname, None)
        if current and fieldname not in always_overwrite:
            continue
        setattr(settings, fieldname, value)
        changed = True

    if changed:
        settings.save(ignore_permissions=True)
        frappe.logger().info("AlaiyOS: Alaiy OS Settings updated")
