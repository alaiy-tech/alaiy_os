import frappe


@frappe.whitelist()
def get_all_agents():
    """Return every OS Agent, joined with its OS Agent Registry metadata, for the settings panel."""
    agents = frappe.get_all(
        "OS Agent",
        fields=["agent_id", "is_enabled"],
        order_by="agent_id asc",
    )
    if not agents:
        return []

    registry_rows = frappe.get_all(
        "OS Agent Registry",
        filters={"agent": ["in", [a["agent_id"] for a in agents]]},
        fields=[
            "agent", "description", "icon", "icon_url",
            "settings_doctype", "test_method",
            "health_status", "last_tested_at",
        ],
    )
    registry_by_agent = {row["agent"]: row for row in registry_rows}

    result = []
    for agent in agents:
        registry = registry_by_agent.get(agent["agent_id"], {})
        result.append({**agent, **{k: v for k, v in registry.items() if k != "agent"}})
    return result


@frappe.whitelist()
def get_agent_config(agent):
    """Return field metadata + current values for an agent's settings DocType."""
    frappe.get_doc("OS Agent", agent).check_permission("read")

    if not frappe.db.exists("OS Agent Registry", agent):
        frappe.throw(f"No registry entry found for agent '{agent}'.")
    registry = frappe.get_doc("OS Agent Registry", agent)
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
def save_and_test(agent, values):
    """Save agent settings then run the agent's test/health-check method."""
    import json

    if isinstance(values, str):
        values = json.loads(values)

    frappe.get_doc("OS Agent", agent).check_permission("write")

    if not frappe.db.exists("OS Agent Registry", agent):
        frappe.throw(f"No registry entry found for agent '{agent}'.")
    registry = frappe.get_doc("OS Agent Registry", agent)
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
def test_agent(agent):
    """Run the agent's test_method and update the registry health status."""
    frappe.get_doc("OS Agent", agent).check_permission("write")

    if not frappe.db.exists("OS Agent Registry", agent):
        return {"success": False, "message": "No registry entry for this agent"}

    row = frappe.get_doc("OS Agent Registry", agent)
    if not row.test_method:
        return {"success": False, "message": "No test method configured"}

    try:
        fn = frappe.get_attr(row.test_method)
        result = fn()
        status = "healthy" if result.get("success") else "failed"
    except Exception as e:
        result = {"success": False, "message": str(e)}
        status = "failed"

    frappe.db.set_value("OS Agent Registry", agent, {
        "health_status": status,
        "last_tested_at": frappe.utils.now_datetime(),
    })
    frappe.db.commit()
    return result
