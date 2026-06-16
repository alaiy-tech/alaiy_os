import frappe

WEBHOOK_DOCTYPES = {
    "Item": ("/webhooks/erpnext/items", ["after_insert", "on_update"]),
    "Item Price": ("/webhooks/erpnext/item-prices", ["after_insert", "on_update"]),
    "Customer": ("/webhooks/erpnext/customers", ["after_insert", "on_update"]),
    "Sales Order": ("/webhooks/erpnext/sales-orders", ["on_submit", "on_cancel"]),
    "Delivery Note": ("/webhooks/erpnext/delivery-notes", ["on_submit"]),
    "Stock Entry": ("/webhooks/erpnext/stock", ["on_submit"]),
    "Stock Reconciliation": ("/webhooks/erpnext/stock", ["on_submit"]),
}


def register_frappe_webhooks(connector_url: str) -> list:
    base = connector_url.rstrip("/")
    created = []
    for doctype, (path, docevents) in WEBHOOK_DOCTYPES.items():
        request_url = f"{base}{path}"
        for docevent in docevents:
            webhook_name = (
                f"shopify-{doctype}-{docevent}".replace(" ", "-").lower()
            )
            if frappe.db.exists("Webhook", webhook_name):
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
                    "webhook_json": "{{ doc | json }}",
                    "enabled": 1,
                }
            )
            doc.insert(ignore_permissions=True)
            created.append(f"{doctype}.{docevent}")
    if created:
        frappe.db.commit()
    return created
