"""Helpers for driving Alaiy OS connectors via the OS Connector Registry.

Connectors register themselves as `OS Connector Registry` rows carrying
dotted-path sync methods. The registry has two generic sync slots -- `categories`
and `items` -- each with a human label the connector chooses (Shopify labels
them "Orders" and "Inventory"). We resolve operations by LABEL so this stays
connector-agnostic: a tool asks for "orders"/"inventory"/etc. and we match it
against whatever labels the connector declared, rather than hard-coding Shopify.
"""

import frappe

# Registry slots: (method_field, label_field). `status` handled separately.
_SYNC_SLOTS = (
    ("sync_categories_method", "sync_categories_label"),
    ("sync_items_method", "sync_items_label"),
)


# Fields every registry consumer needs. api/connectors.py's settings panel asks
# for a wider set on top of these (see get_connectors(fields=...)).
_CORE_FIELDS = [
    "name",
    "connector_id",
    "connector_name",
    "is_enabled",
    "connection_status",
    "last_tested_at",
    "sync_categories_method",
    "sync_categories_label",
    "sync_items_method",
    "sync_items_label",
    "sync_status_method",
]


def get_connectors(connector_type=None, only_enabled=False, fields=None, order_by="connector_id"):
    """Return OS Connector Registry rows, optionally filtered by connector type.

    Guards on the DocType existing so callers still work on a site where the
    registry hasn't been migrated in yet.
    """
    if not frappe.db.exists("DocType", "OS Connector Registry"):
        return []
    filters = {}
    if connector_type:
        filters["connector_type"] = connector_type
    if only_enabled:
        filters["is_enabled"] = 1
    return frappe.get_all(
        "OS Connector Registry",
        filters=filters,
        fields=fields or _CORE_FIELDS,
        order_by=order_by,
    )


def get_channel_connectors(only_enabled=False):
    """Return OS Connector Registry rows of type 'channel'."""
    return get_connectors(connector_type="channel", only_enabled=only_enabled)


def sync_operations(row):
    """Map a connector row to its available sync ops keyed by lowercased label.

    e.g. Shopify -> {"orders": "<dotted>", "inventory": "<dotted>"}.
    Slots without a method are skipped.
    """
    ops = {}
    for method_field, label_field in _SYNC_SLOTS:
        method = row.get(method_field)
        if not method:
            continue
        label = (row.get(label_field) or method_field.replace("sync_", "").replace("_method", "")).strip()
        ops[label.lower()] = method
    return ops


def call_dotted(method_path, **kwargs):
    """Resolve and call a dotted-path connector method."""
    fn = frappe.get_attr(method_path)
    return fn(**kwargs) if kwargs else fn()


def resolve_channel(channel):
    """Find a single channel connector row by connector_id/name (case-insensitive).

    Returns the row dict or None. 'all' is handled by callers, not here.
    """
    if not channel:
        return None
    target = channel.strip().lower()
    for row in get_channel_connectors():
        if target in (row["connector_id"].lower(), (row.get("connector_name") or "").lower()):
            return row
    return None
