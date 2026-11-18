"""Connector Health: the data behind /app/connector-health, as JSON.

System Manager only. Reads only; the one action, `run_sync`, runs a sync operation the connector
itself registered, never a path the caller supplies.
"""

import frappe
from frappe.utils import now_datetime


@frappe.whitelist()
def get_health():
    """Platform checks and the state of every connector function on this site."""
    frappe.only_for("System Manager")
    from alaiy_os.health.service import snapshot

    return snapshot(now_datetime())


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
