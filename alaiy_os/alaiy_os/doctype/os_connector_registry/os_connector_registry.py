import frappe
from frappe.model.document import Document

# Data fields holding a Python dotted path, keyed by their form label — kept
# in sync with os_connector_registry.json's field_order.
_HANDLER_FIELDS = {
    "test_method": "Test Method",
    "sync_categories_method": "Sync Categories Method",
    "sync_items_method": "Sync Items Method",
    "sync_status_method": "Sync Status Method",
}


class OSConnectorRegistry(Document):
    def validate(self):
        self._validate_handlers()

    def _validate_handlers(self):
        # Fail at registration time, not mid-sync: every configured dotted
        # path must import and be callable. Mirrors OSAgentTool._validate_handler().
        for fieldname, label in _HANDLER_FIELDS.items():
            path = self.get(fieldname)
            if not path:
                continue
            try:
                fn = frappe.get_attr(path)
            except Exception:
                frappe.throw(f"{label} <code>{path}</code> could not be imported.")
            if not callable(fn):
                frappe.throw(f"{label} <code>{path}</code> is not callable.")
