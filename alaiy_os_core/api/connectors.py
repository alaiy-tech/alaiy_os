import frappe


@frappe.whitelist()
def get_all_connectors():
    """Return all OS Connector Registry rows for the settings panel."""
    if not frappe.db.exists("DocType", "OS Connector Registry"):
        return []
    return frappe.get_all(
        "OS Connector Registry",
        fields=[
            "connector_id", "connector_name", "connector_app",
            "connector_type", "description", "icon", "icon_url",
            "settings_doctype", "test_method",
            "is_enabled", "connection_status", "last_tested_at",
        ],
        order_by="connector_name asc",
    )


@frappe.whitelist()
def get_connector_config(connector_id):
    """Return field metadata + current values for a connector's settings DocType."""
    registry = frappe.get_doc("OS Connector Registry", connector_id)
    settings_doctype = registry.settings_doctype

    if not settings_doctype:
        frappe.throw("No settings DocType configured for this connector.")
    if not frappe.db.exists("DocType", settings_doctype):
        frappe.throw(f"Settings DocType '{settings_doctype}' not found.")

    RENDERABLE = {"Data", "Password", "Int", "Link", "Select", "Check", "Text", "Small Text"}
    meta = frappe.get_meta(settings_doctype)
    fields = []
    for f in meta.fields:
        if f.fieldtype not in RENDERABLE:
            continue
        fields.append({
            "fieldname": f.fieldname,
            "label": f.label,
            "fieldtype": f.fieldtype,
            "options": f.options,
            "reqd": f.reqd,
            "description": f.description,
        })

    doc = frappe.get_single(settings_doctype)
    values = {}
    for f in fields:
        if f["fieldtype"] == "Password":
            raw = doc.get(f["fieldname"])
            values[f["fieldname"]] = {"_type": "password", "_set": bool(raw)}
        else:
            values[f["fieldname"]] = doc.get(f["fieldname"])

    return {"fields": fields, "values": values}


@frappe.whitelist()
def get_connector_password(connector_id, fieldname):
    """Return the decrypted value of a Password field for display."""
    registry = frappe.get_doc("OS Connector Registry", connector_id)
    meta = frappe.get_meta(registry.settings_doctype)
    field_meta = meta.get_field(fieldname)
    if not field_meta or field_meta.fieldtype != "Password":
        frappe.throw("Invalid field")
    doc = frappe.get_single(registry.settings_doctype)
    return doc.get_password(fieldname, raise_exception=False) or ""


@frappe.whitelist()
def save_and_test(connector_id, values):
    """Save connector settings then run the connector's test method."""
    import json

    if isinstance(values, str):
        values = json.loads(values)

    registry = frappe.get_doc("OS Connector Registry", connector_id)
    settings_doctype = registry.settings_doctype
    test_method = registry.test_method

    doc = frappe.get_single(settings_doctype)
    meta = frappe.get_meta(settings_doctype)

    for fieldname, value in values.items():
        field_meta = meta.get_field(fieldname)
        if not field_meta:
            continue
        if field_meta.fieldtype == "Password":
            if value and str(value).strip():
                doc.set(fieldname, value)
        else:
            doc.set(fieldname, value)

    doc.save(ignore_permissions=True)
    frappe.db.commit()

    try:
        test_fn = frappe.get_attr(test_method)
        result = test_fn()
    except Exception as e:
        result = {"success": False, "message": str(e)}

    registry.connection_status = "connected" if result.get("success") else "failed"
    registry.last_tested_at = frappe.utils.now_datetime()
    registry.save(ignore_permissions=True)
    frappe.db.commit()

    return result
