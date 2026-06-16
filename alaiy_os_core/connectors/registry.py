import frappe
from alaiy_os_core.client.config import boot_config


def setup_connectors() -> None:
    enabled = getattr(boot_config, "ENABLED_CONNECTORS", [])
    if not enabled:
        return
    for connector_id in enabled:
        try:
            if connector_id == "shopify":
                _setup_shopify()
            else:
                frappe.log_error(
                    f"AlaiyOS: unknown connector '{connector_id}'",
                    "Connector setup",
                )
        except Exception:
            frappe.log_error(
                frappe.get_traceback(),
                f"AlaiyOS: connector setup failed: {connector_id}",
            )


def _setup_shopify() -> None:
    from alaiy_os_core.connectors.shopify.fields import register_custom_fields
    from alaiy_os_core.connectors.shopify.webhooks import register_frappe_webhooks

    register_custom_fields()
    connector_url = getattr(boot_config, "SHOPIFY_CONNECTOR_URL", "").strip()
    if not connector_url:
        return
    register_frappe_webhooks(connector_url)
