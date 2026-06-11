"""
Scheduled job entry points for Cloudstore sync.

Registered in hooks.py scheduler_events; called by the Frappe RQ worker.
Each entry point owns: settings read, client construction, service call,
sync log write, and graceful error handling.
"""

from __future__ import annotations

import frappe
from alaiy_os_core.connectors.cloudstore.client import CloudstoreClient, CloudstoreAPIError
from alaiy_os_core.connectors.cloudstore import (
    category_service,
    product_service,
    order_service,
)


def _get_client_and_settings() -> tuple[CloudstoreClient | None, object | None]:
    """
    Return (client, settings) or (None, None) if sync should be skipped.

    Guard 1 — config file: connector_config.json must have cloudstore.enabled = true.
    Guard 2 — DB flag: Alaiy OS Settings.cloudstore_sync_enabled must be 1.
    """
    from alaiy_os_core.config.loader import is_connector_enabled
    if not is_connector_enabled("cloudstore"):
        frappe.logger().info("Cloudstore disabled in connector_config.json — skipping sync")
        return None, None

    settings = frappe.get_single("Alaiy OS Settings")
    if not settings.cloudstore_sync_enabled:
        frappe.logger().info("Cloudstore disabled in Alaiy OS Settings — skipping sync")
        return None, None

    if not settings.cloudstore_api_url or not settings.cloudstore_api_token:
        frappe.log_error(
            "cloudstore_api_url or cloudstore_api_token not set in Alaiy OS Settings.",
            "Cloudstore sync skipped",
        )
        return None, None

    client = CloudstoreClient(
        base_url=settings.cloudstore_api_url,
        token=settings.get_password("cloudstore_api_token"),
    )
    return client, settings


def _new_log(sync_type: str):
    log = frappe.new_doc("Cloudstore Sync Log")
    log.sync_type = sync_type
    log.status = "Running"
    log.started_at = frappe.utils.now_datetime()
    log.insert(ignore_permissions=True)
    frappe.db.commit()
    return log


def _finish_log(log, result: dict) -> None:
    log.finished_at = frappe.utils.now_datetime()
    log.items_fetched = result.get("fetched", result.get("events_processed", 0))
    log.items_created = result.get("created", 0)
    log.items_updated = result.get("updated", 0)
    log.items_skipped = result.get("skipped", 0)
    errors = result.get("errors") or []
    log.error_log = "\n".join(errors) if errors else ""
    log.status = (
        "Failed" if errors and not result.get("created") and not result.get("updated")
        else "Partial" if errors
        else "Success"
    )
    if result.get("last_event_id"):
        log.last_event_id = result["last_event_id"]
    log.save(ignore_permissions=True)
    frappe.db.commit()


# ------------------------------------------------------------------
# Scheduled entry points
# ------------------------------------------------------------------

def sync_categories() -> None:
    """Sync Cloudstore category tree to ERPNext Item Groups."""
    client, _ = _get_client_and_settings()
    if not client:
        return

    log = _new_log("category_tree")
    try:
        result = category_service.sync_categories(client)
    except Exception as exc:  # noqa: BLE001
        frappe.log_error(str(exc), "Cloudstore category sync crashed")
        result = {"created": 0, "updated": 0, "skipped": 0, "errors": [str(exc)]}

    _finish_log(log, result)


def sync_full_catalog() -> None:
    """Full product catalog sync — run once on setup or for a full refresh."""
    client, settings = _get_client_and_settings()
    if not client:
        return

    log = _new_log("full_catalog")
    try:
        result = product_service.sync_full_catalog(
            client=client,
            supplier=settings.cloudstore_supplier or "",
            price_list=settings.cloudstore_price_list or "",
            warehouse=settings.cloudstore_default_warehouse or "",
            page_size=settings.cloudstore_page_size or 100,
        )
    except Exception as exc:  # noqa: BLE001
        frappe.log_error(str(exc), "Cloudstore full catalog sync crashed")
        result = {"fetched": 0, "created": 0, "updated": 0, "skipped": 0, "errors": [str(exc)]}

    _finish_log(log, result)


def sync_incremental() -> None:
    """Incremental event-based sync — picks up from the last stored event ID."""
    client, _ = _get_client_and_settings()
    if not client:
        return

    last_event_id = frappe.db.get_value(
        "Cloudstore Sync Log",
        {"sync_type": "incremental", "status": ["in", ["Success", "Partial"]]},
        "last_event_id",
        order_by="started_at desc",
    )

    log = _new_log("incremental")
    try:
        result = product_service.sync_stock_updates(client, since_event_id=last_event_id)
    except Exception as exc:  # noqa: BLE001
        frappe.log_error(str(exc), "Cloudstore incremental sync crashed")
        result = {"events_processed": 0, "last_event_id": last_event_id, "errors": [str(exc)]}

    _finish_log(log, result)
