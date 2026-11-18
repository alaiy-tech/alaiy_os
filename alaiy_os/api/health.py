"""Connector Health as JSON: the page's data, and endpoints for dashboards and other instances.

`get_health` feeds the Connector Health page (System Manager only). `get_summary`, `get_report` and
`get_connector` are the stable, versioned API for custom dashboards: ISO 8601 times, an envelope with
the instance name, and a snapshot the 5-minute job keeps warm. They are open to System Manager and OS
Manager, so a dashboard can use a read-only user's API key. `run_sync` is the one action, runs only a
sync operation the connector itself registered, and stays System Manager only.
"""

from zoneinfo import ZoneInfo

import frappe
from frappe.utils import cint, get_system_timezone, now_datetime

READ_ROLES = ("System Manager", "OS Manager")
SNAPSHOT_MAX_AGE_SECONDS = 300


@frappe.whitelist()
def get_health():
    """Platform checks and the state of every connector function on this site (the page's data)."""
    frappe.only_for("System Manager")
    from alaiy_os.health.service import snapshot

    return snapshot(now_datetime())


def _timezone():
    try:
        return ZoneInfo(get_system_timezone())
    except Exception:
        return None


def _collected(live):
    """The latest snapshot: the stored one if recent enough, otherwise a fresh one (which is stored)."""
    from alaiy_os.health import service
    from alaiy_os.health.report import fresh

    now = now_datetime()
    stored = None if cint(live) else frappe.cache.get_value(service.CACHE_KEY)
    if stored and fresh(stored, now, SNAPSHOT_MAX_AGE_SECONDS):
        return stored
    collected = service.snapshot(now)
    frappe.cache.set_value(service.CACHE_KEY, collected, expires_in_sec=service.CACHE_SECONDS)
    return collected


@frappe.whitelist()
def get_summary(live=0):
    """A compact summary for dashboards: overall status, counts per state, the problems and the
    platform checks. `live=1` recomputes instead of serving the stored snapshot."""
    frappe.only_for(READ_ROLES)
    from alaiy_os.health.report import jsonable, summary_payload

    collected = _collected(live)
    return jsonable(summary_payload(collected, frappe.local.site, collected["checked_at"]), _timezone())


@frappe.whitelist()
def get_report(live=0):
    """Everything the page shows, with the same envelope and ISO 8601 times."""
    frappe.only_for(READ_ROLES)
    from alaiy_os.health.report import full_payload, jsonable

    collected = _collected(live)
    return jsonable(full_payload(collected, frappe.local.site, collected["checked_at"]), _timezone())


@frappe.whitelist()
def get_connector(connector_id, live=0):
    """One connector with all its functions."""
    frappe.only_for(READ_ROLES)
    from alaiy_os.health.report import connector_payload, jsonable

    collected = _collected(live)
    try:
        payload = connector_payload(collected, connector_id, frappe.local.site, collected["checked_at"])
    except LookupError as error:
        frappe.throw(str(error))
    return jsonable(payload, _timezone())


@frappe.whitelist(methods=["POST"])
def run_sync(connector_id, operation):
    """Run one of the sync operations a connector registered (for example "Items")."""
    frappe.only_for("System Manager")
    from alaiy_os.connectors import sync_operations
    from alaiy_os.health.service import pick_operation

    registry = frappe.get_doc("OS Connector Registry", connector_id)
    try:
        path = pick_operation(sync_operations(registry), operation)
    except ValueError as error:
        frappe.throw(str(error))
    # A sync outlasts a web request: run it in a worker, and never send its errors back to the browser.
    frappe.enqueue("alaiy_os.connectors.call_dotted", queue="long", timeout=3600, method_path=path)
    return {"queued": True}
