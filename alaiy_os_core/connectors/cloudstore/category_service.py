"""
Sync Cloudstore category tree → ERPNext Item Groups.

Strategy:
- Root categories become children of "Products" Item Group (ERPNext default root).
- Sub-categories are nested under their mapped parent.
- Existing Item Groups are matched by the cloudstore_category_id custom field;
  never deleted — only created or renamed.
"""

import frappe
from alaiy_os_core.connectors.cloudstore.client import CloudstoreClient, CloudstoreAPIError
from alaiy_os_core.connectors.cloudstore.mapper import map_category


_ROOT_GROUP = "Products"


def sync_categories(client: CloudstoreClient) -> dict:
    """
    Pull the full category tree and upsert into ERPNext Item Groups.

    Returns { "created": int, "updated": int, "errors": list[str] }
    """
    result = {"created": 0, "updated": 0, "errors": []}

    try:
        raw_categories = client.get_categories()
    except CloudstoreAPIError as exc:
        frappe.log_error(str(exc), "Cloudstore category fetch failed")
        result["errors"].append(str(exc))
        return result

    mapped = [map_category(c) for c in raw_categories]

    # Build id→name lookup so we can resolve parent names before upserting
    id_to_name: dict[str, str] = {}
    for cat in mapped:
        if cat["cloudstore_id"]:
            id_to_name[cat["cloudstore_id"]] = cat["name"]

    # Process root categories first, then children (simple two-pass)
    roots = [c for c in mapped if not c["parent_id"]]
    children = [c for c in mapped if c["parent_id"]]

    for cat in roots + children:
        try:
            _upsert_item_group(cat, id_to_name, result)
        except Exception as exc:  # noqa: BLE001
            msg = f"Item Group upsert failed for {cat.get('name')}: {exc}"
            frappe.log_error(msg, "Cloudstore category sync error")
            result["errors"].append(msg)

    return result


def _upsert_item_group(cat: dict, id_to_name: dict[str, str], result: dict) -> None:
    cloudstore_id = cat["cloudstore_id"]
    group_name = cat["name"]

    if cat["parent_id"]:
        parent_name = id_to_name.get(cat["parent_id"], _ROOT_GROUP)
    else:
        parent_name = _ROOT_GROUP

    existing = frappe.db.get_value(
        "Item Group",
        {"cloudstore_category_id": cloudstore_id},
        "name",
    )

    if existing:
        doc = frappe.get_doc("Item Group", existing)
        changed = False
        if doc.item_group_name != group_name:
            doc.item_group_name = group_name
            changed = True
        if doc.parent_item_group != parent_name:
            doc.parent_item_group = parent_name
            changed = True
        if changed:
            doc.save(ignore_permissions=True)
            result["updated"] += 1
    else:
        doc = frappe.new_doc("Item Group")
        doc.item_group_name = group_name
        doc.parent_item_group = parent_name
        doc.cloudstore_category_id = cloudstore_id
        doc.insert(ignore_permissions=True)
        result["created"] += 1
