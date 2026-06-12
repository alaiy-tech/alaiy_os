"""
Connector management API — called by the frontend Settings page.
"""

import json
import frappe


CONNECTOR_REGISTRY: dict[str, dict] = {
    "cloudstore": {
        "id": "cloudstore",
        "name": "The Corner / Cloudstore",
        "description": "Italian luxury fashion supplier catalog and order sync",
        "logo": "/assets/alaiy_os_core/images/cloudstore_logo.png",
        "credential_fields": [
            {
                "key": "cloudstore_api_url",
                "label": "API URL",
                "type": "text",
                "placeholder": "https://sandbox.csplatform.io:9950",
            },
            {
                "key": "cloudstore_api_token",
                "label": "API Token",
                "type": "password",
                "placeholder": "Bearer token from Cloudstore",
            },
        ],
        "required_credentials": ["cloudstore_api_url", "cloudstore_api_token"],
        "enabled_field": "cloudstore_enabled",
    },
    "shopify": {
        "id": "shopify",
        "name": "Shopify",
        "description": "Sync orders and inventory with your Shopify store",
        "logo": "/assets/alaiy_os_core/images/shopify_logo.png",
        "credential_fields": [
            {
                "key": "shopify_shop_url",
                "label": "Shop URL",
                "type": "text",
                "placeholder": "your-store.myshopify.com",
            },
            {
                "key": "shopify_access_token",
                "label": "Access Token",
                "type": "password",
                "placeholder": "shpat_...",
            },
        ],
        "required_credentials": ["shopify_shop_url", "shopify_access_token"],
        "enabled_field": "shopify_enabled",
    },
}


@frappe.whitelist()
def get_connectors() -> list:
    settings = frappe.get_single("Alaiy OS Settings")
    result = []

    for meta in CONNECTOR_REGISTRY.values():
        enabled = bool(getattr(settings, meta["enabled_field"], False))
        configured = all(
            bool(getattr(settings, key, ""))
            for key in meta["required_credentials"]
        )
        result.append({
            "id": meta["id"],
            "name": meta["name"],
            "description": meta["description"],
            "logo": meta["logo"],
            "enabled": enabled,
            "configured": configured,
            "credential_fields": meta["credential_fields"],
        })

    return result


@frappe.whitelist()
def save_connector_credentials(connector_id: str, credentials) -> dict:
    if connector_id not in CONNECTOR_REGISTRY:
        frappe.throw(f"Unknown connector: {connector_id}")

    if isinstance(credentials, str):
        credentials = json.loads(credentials)

    meta = CONNECTOR_REGISTRY[connector_id]
    settings = frappe.get_single("Alaiy OS Settings")

    for field in meta["credential_fields"]:
        key = field["key"]
        value = credentials.get(key, "")
        if value:
            setattr(settings, key, value)

    settings.save(ignore_permissions=True)
    frappe.db.commit()
    return {"success": True}


@frappe.whitelist()
def toggle_connector(connector_id: str, enabled) -> dict:
    if connector_id not in CONNECTOR_REGISTRY:
        frappe.throw(f"Unknown connector: {connector_id}")

    if isinstance(enabled, str):
        enabled = enabled.lower() in ("true", "1", "yes")

    meta = CONNECTOR_REGISTRY[connector_id]
    settings = frappe.get_single("Alaiy OS Settings")

    if enabled:
        # Verify credentials are present before enabling
        missing = [
            key for key in meta["required_credentials"]
            if not getattr(settings, key, "")
        ]
        if missing:
            return {"success": False, "needs_credentials": True}

        # Run health check for known connectors
        health = _run_health_check(connector_id, settings)
        if not health["ok"]:
            return {"success": False, "error": health.get("error", "Health check failed")}

        # Create master data on first enable
        if connector_id == "cloudstore":
            _setup_cloudstore_master_data(settings)
        elif connector_id == "shopify":
            _setup_shopify_master_data(settings)

    setattr(settings, meta["enabled_field"], 1 if enabled else 0)
    settings.save(ignore_permissions=True)
    frappe.db.commit()
    return {"success": True, "enabled": bool(enabled)}


@frappe.whitelist()
def test_connector(connector_id: str) -> dict:
    if connector_id not in CONNECTOR_REGISTRY:
        frappe.throw(f"Unknown connector: {connector_id}")

    settings = frappe.get_single("Alaiy OS Settings")
    return _run_health_check(connector_id, settings)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _run_health_check(connector_id: str, settings) -> dict:
    if connector_id == "cloudstore":
        from alaiy_os_core.connectors.cloudstore.client import CloudstoreClient
        try:
            client = CloudstoreClient(
                base_url=settings.cloudstore_api_url or "",
                token=settings.cloudstore_api_token or "",
            )
            return client.health_check()
        except ValueError as e:
            return {"ok": False, "error": str(e)}

    if connector_id == "shopify":
        from alaiy_os_core.connectors.shopify.client import ShopifyClient
        try:
            client = ShopifyClient(
                shop_url=settings.shopify_shop_url or "",
                access_token=settings.shopify_access_token or "",
            )
            return client.health_check()
        except ValueError as e:
            return {"ok": False, "error": str(e)}

    return {"ok": True}


def _setup_cloudstore_master_data(settings) -> None:
    """
    Idempotently create the Supplier, Price List, and Warehouse that the
    Cloudstore sync jobs need. Called once when the connector is first enabled.
    """
    supplier_name = "The Corner"
    price_list_name = "Cloudstore Supplier Price"
    warehouse_name = "Altomoda Stores"

    # Supplier
    if not frappe.db.exists("Supplier", supplier_name):
        if not frappe.db.exists("Supplier Group", "All Supplier Groups"):
            sg = frappe.new_doc("Supplier Group")
            sg.supplier_group_name = "All Supplier Groups"
            sg.is_group = 1
            sg.insert(ignore_permissions=True)
        doc = frappe.new_doc("Supplier")
        doc.supplier_name = supplier_name
        doc.supplier_group = "All Supplier Groups"
        doc.country = "Italy"
        doc.insert(ignore_permissions=True)

    # Price List
    if not frappe.db.exists("Price List", price_list_name):
        doc = frappe.new_doc("Price List")
        doc.price_list_name = price_list_name
        doc.currency = "EUR"
        doc.buying = 1
        doc.selling = 0
        doc.enabled = 1
        doc.insert(ignore_permissions=True)

    # Warehouse
    actual_warehouse = _ensure_warehouse(warehouse_name)

    # Write references back to settings
    settings.cloudstore_supplier = supplier_name
    settings.cloudstore_price_list = price_list_name
    settings.cloudstore_default_warehouse = actual_warehouse
    # Don't save here — caller saves after this returns


def _setup_shopify_master_data(settings) -> None:
    """
    Idempotently create the Price List needed for Shopify selling prices.
    Also syncs Shopify locations into the Shopify Location DocType.
    Called once when the Shopify connector is first enabled.
    """
    price_list_name = "Shopify Selling Price"
    if not frappe.db.exists("Price List", price_list_name):
        doc = frappe.new_doc("Price List")
        doc.price_list_name = price_list_name
        doc.currency = "EUR"
        doc.buying = 0
        doc.selling = 1
        doc.enabled = 1
        doc.insert(ignore_permissions=True)

    settings.shopify_default_price_list = price_list_name

    # Sync locations asynchronously — best-effort; failure here must not block enable
    try:
        from alaiy_os_core.connectors.shopify.client import ShopifyClient
        from alaiy_os_core.connectors.shopify.inventory_service import sync_locations
        client = ShopifyClient(
            shop_url=settings.shopify_shop_url or "",
            access_token=settings.shopify_access_token or "",
        )
        sync_locations(client)
    except Exception as e:
        frappe.log_error(str(e), "Shopify: location sync on first enable failed (non-fatal)")


def _ensure_warehouse(name: str) -> str:
    if frappe.db.exists("Warehouse", name):
        return name
    company = frappe.db.get_single_value("Global Defaults", "default_company")
    if company:
        abbr = frappe.db.get_value("Company", company, "abbr")
        full_name = f"{name} - {abbr}"
        if frappe.db.exists("Warehouse", full_name):
            return full_name
        doc = frappe.new_doc("Warehouse")
        doc.warehouse_name = name
        doc.company = company
        doc.insert(ignore_permissions=True)
        return doc.name
    existing = frappe.get_all("Warehouse", limit=1, pluck="name")
    return existing[0] if existing else ""
