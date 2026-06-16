import frappe

# DocType → (connector path, list of Frappe docevents)
_WEBHOOK_MAP: dict[str, tuple[str, list[str]]] = {
    "Item":               ("/webhooks/erpnext/items",        ["after_insert", "on_update"]),
    "Item Price":         ("/webhooks/erpnext/item-prices",  ["after_insert", "on_update"]),
    "Customer":           ("/webhooks/erpnext/customers",    ["after_insert", "on_update"]),
    "Sales Order":        ("/webhooks/erpnext/sales-orders", ["on_submit", "on_cancel"]),
    "Delivery Note":      ("/webhooks/erpnext/delivery-notes", ["on_submit"]),
    "Stock Entry":        ("/webhooks/erpnext/stock",        ["on_submit"]),
    "Stock Reconciliation": ("/webhooks/erpnext/stock",      ["on_submit"]),
}


def register_frappe_webhooks(connector_url: str) -> list[str]:
    """Idempotently create Frappe Webhook records pointing at the connector server.

    `connector_url` is the base URL (no trailing slash), e.g. https://abc.ngrok.io

    Returns the list of 'DocType.docevent' strings that were newly created.
    """
    base = connector_url.rstrip("/")
    created: list[str] = []
    for doctype, (path, docevents) in _WEBHOOK_MAP.items():
        request_url = f"{base}{path}"
        for docevent in docevents:
            webhook_name = f"Shopify-{doctype}-{docevent}"
            if frappe.db.exists("Webhook", webhook_name):
                continue
            # Also skip if a webhook with the same url+doctype+docevent already
            # exists under a different name (e.g. manually created).
            duplicate = frappe.db.exists(
                "Webhook",
                {
                    "webhook_doctype": doctype,
                    "webhook_docevent": docevent,
                    "request_url": request_url,
                },
            )
            if duplicate:
                continue
            doc = frappe.get_doc(
                {
                    "doctype": "Webhook",
                    "name": webhook_name,
                    "webhook_doctype": doctype,
                    "webhook_docevent": docevent,
                    "request_url": request_url,
                    "request_method": "POST",
                    "request_structure": "JSON",
                    # Send the full document as JSON. `doc | json` uses
                    # Frappe's own encoder (handles dates, Decimals, etc.).
                    "webhook_json": "{{ doc | json }}",
                    "enabled": 1,
                }
            )
            doc.insert(ignore_permissions=True)
            created.append(f"{doctype}.{docevent}")
    return created
