import frappe
from alaiy_os_core.public.config import brand_config


def setup_connectors() -> None:
    """Activate all connectors listed in brand_config.ENABLED_CONNECTORS.

    Called from install.py's run_setup() on every `bench migrate`.
    Each connector registers its Custom Fields and Frappe Webhooks idempotently.
    """
    enabled = getattr(brand_config, "ENABLED_CONNECTORS", [])
    if not enabled:
        return

    for connector_id in enabled:
        try:
            if connector_id == "shopify":
                _setup_shopify()
            else:
                frappe.log_error(
                    f"AlaiyOS: unknown connector '{connector_id}' in ENABLED_CONNECTORS",
                    "Connector setup",
                )
        except Exception:
            frappe.log_error(frappe.get_traceback(), f"AlaiyOS: connector setup failed: {connector_id}")


def _setup_shopify() -> None:
    from alaiy_os_core.connectors.shopify.fields import register_custom_fields
    from alaiy_os_core.connectors.shopify.webhooks import register_frappe_webhooks

    created_fields = register_custom_fields()
    if created_fields:
        frappe.log_error(
            f"Created Shopify custom fields: {', '.join(created_fields)}",
            "AlaiyOS Shopify setup",
        )

    connector_url = getattr(brand_config, "SHOPIFY_CONNECTOR_URL", "").strip()
    if not connector_url:
        return

    created_webhooks = register_frappe_webhooks(connector_url)
    if created_webhooks:
        frappe.log_error(
            f"Created Shopify Frappe webhooks: {', '.join(created_webhooks)}",
            "AlaiyOS Shopify setup",
        )
