import frappe


@frappe.whitelist()
def get_all_agents():
    """Return all OS Agent Registry rows for the settings panel."""
    if not frappe.db.exists("DocType", "OS Agent Registry"):
        return []
    return frappe.get_all(
        "OS Agent Registry",
        fields=[
            "agent_id", "agent_name", "agent_app",
            "agent_type", "description", "icon", "icon_url",
            "settings_doctype", "capabilities",
            "invoke_method", "test_method",
            "is_enabled", "health_status", "last_tested_at", "last_invoked_at",
        ],
        order_by="agent_name asc",
    )


@frappe.whitelist()
def get_agent_config(agent_id):
    """Return field metadata + current values for an agent's settings DocType."""
    registry = frappe.get_doc("OS Agent Registry", agent_id)
    settings_doctype = registry.settings_doctype

    if not settings_doctype:
        frappe.throw("No settings DocType configured for this agent.")
    if not frappe.db.exists("DocType", settings_doctype):
        frappe.throw(f"Settings DocType '{settings_doctype}' not found.")

    RENDERABLE = {"Data", "Password", "Int", "Float", "Link", "Select", "Check", "Text", "Small Text", "Section Break"}
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
def get_agent_password(agent_id, fieldname):
    """Return the decrypted value of a Password field for display."""
    registry = frappe.get_doc("OS Agent Registry", agent_id)
    meta = frappe.get_meta(registry.settings_doctype)
    field_meta = meta.get_field(fieldname)
    if not field_meta or field_meta.fieldtype != "Password":
        frappe.throw("Invalid field")
    doc = frappe.get_single(registry.settings_doctype)
    return doc.get_password(fieldname, raise_exception=False) or ""


@frappe.whitelist()
def save_and_test(agent_id, values):
    """Save agent settings then run the agent's test/health-check method."""
    import json

    if isinstance(values, str):
        values = json.loads(values)

    registry = frappe.get_doc("OS Agent Registry", agent_id)
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
        success = bool(result.get("success"))
    except Exception as e:
        result = {"success": False, "message": str(e)}
        success = False

    registry.health_status = "healthy" if success else "failed"
    registry.last_tested_at = frappe.utils.now_datetime()
    registry.save(ignore_permissions=True)
    frappe.db.commit()

    return result


@frappe.whitelist()
def test_agent(agent_id):
    """Run the agent's test_method and update the registry health status."""
    if not frappe.db.exists("OS Agent Registry", agent_id):
        return {"success": False, "message": "Agent not found"}

    row = frappe.get_doc("OS Agent Registry", agent_id)
    if not row.test_method:
        return {"success": False, "message": "No test method configured"}

    try:
        fn = frappe.get_attr(row.test_method)
        result = fn()
        status = "healthy" if result.get("success") else "failed"
    except Exception as e:
        result = {"success": False, "message": str(e)}
        status = "failed"

    frappe.db.set_value("OS Agent Registry", agent_id, {
        "health_status": status,
        "last_tested_at": frappe.utils.now_datetime(),
    })
    frappe.db.commit()
    return result


@frappe.whitelist()
def invoke_agent(agent_id, **kwargs):
    """Run the agent's invoke_method with the given kwargs and record the run."""
    if not frappe.db.exists("OS Agent Registry", agent_id):
        return {"success": False, "message": "Agent not found"}

    row = frappe.get_doc("OS Agent Registry", agent_id)
    if not row.is_enabled:
        return {"success": False, "message": "Agent is disabled"}
    if not row.invoke_method:
        return {"success": False, "message": "No invoke method configured"}

    try:
        fn = frappe.get_attr(row.invoke_method)
        result = fn(**kwargs)
    except Exception as e:
        result = {"success": False, "message": str(e)}

    frappe.db.set_value("OS Agent Registry", agent_id, {
        "last_invoked_at": frappe.utils.now_datetime(),
    })
    frappe.db.commit()
    return result
