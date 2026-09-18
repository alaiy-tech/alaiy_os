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
            "sync_categories_method", "sync_items_method", "sync_status_method",
            "sync_categories_label", "sync_items_label",
            "is_enabled", "connection_status", "last_tested_at",
        ],
        order_by="connector_name asc",
    )


# --- the one document behind a connector's settings screen --------------------
#
# A connector registers a `settings_doctype` and the endpoints below read and
# write it without knowing what it holds. That used to mean `frappe.get_single`,
# because every connector registered a Single.
#
# Two of them no longer do. Amazon Connection and Shopify Connection both moved
# out of tabSingles so one bench can hold several sellers, and `get_single` is
# `get_doc(doctype, doctype)` — on a normal DocType that names a record nothing
# creates, so every endpoint here raised DoesNotExistError and those connectors'
# settings screens could not load at all. The registry row was fine, which is
# why the Connectors index kept working and only the screen behind a card broke.


def _settings_doctype(registry):
    """The registered settings DocType, or a message saying why there is none."""
    settings_doctype = registry.settings_doctype
    if not settings_doctype:
        frappe.throw(
            f"The {registry.connector_name} connector registered no settings DocType, "
            "so it has no settings to show."
        )
    if not frappe.db.exists("DocType", settings_doctype):
        frappe.throw(
            f"The {registry.connector_name} connector registered '{settings_doctype}' "
            "as its settings DocType, and no such DocType is installed."
        )
    return settings_doctype


def _settings_name(settings_doctype, meta):
    """Which row of a non-Single settings DocType this API is about.

    The same question `connections.resolve_name` answers inside the Amazon
    connector, and deliberately the same answer: the row flagged `is_default`,
    or the only row there is. Several rows with no default is the multi-seller
    case, and picking one would read and write some other seller's credentials —
    so that refuses rather than guesses, and says so.

    Returns None when the DocType has no rows at all. That is not an error for a
    read: a connector that has never been set up has defaults worth rendering.
    """
    if meta.has_field("is_default"):
        default = frappe.db.get_value(settings_doctype, {"is_default": 1}, "name")
        if default:
            return default

    names = frappe.get_all(settings_doctype, pluck="name", limit=2, order_by="creation asc")
    if len(names) == 1:
        return names[0]
    if not names:
        return None

    frappe.throw(
        f"This site has more than one {settings_doctype}, so there is no single one "
        "to show here. Mark one as the default, or manage them from the Desk."
    )


def _settings_doc(registry, *, for_write=False):
    """The settings document to read from, or write to.

    `for_write` is what separates a screen that renders a connector's defaults
    from one that saves them. A read of a DocType with no rows answers with an
    unsaved document — the field defaults, which is what a never-configured
    connector should show — while a write refuses, because inserting the first
    row means naming it, and only the connector knows what its own naming series
    or `field:` autoname wants.
    """
    settings_doctype = _settings_doctype(registry)
    meta = frappe.get_meta(settings_doctype)

    if meta.issingle:
        return frappe.get_single(settings_doctype)

    name = _settings_name(settings_doctype, meta)
    if name:
        return frappe.get_doc(settings_doctype, name)

    if for_write:
        frappe.throw(
            f"There is no {settings_doctype} on this site yet, so there is nothing to "
            f"save to. Set the {registry.connector_name} connector up first."
        )
    return frappe.new_doc(settings_doctype)


@frappe.whitelist()
def get_connector_config(connector_id):
    """Return field metadata + current values for a connector's settings DocType."""
    registry = frappe.get_doc("OS Connector Registry", connector_id)
    doc = _settings_doc(registry)

    RENDERABLE = {"Data", "Password", "Int", "Float", "Link", "Select", "Check", "Text", "Small Text", "Section Break"}
    meta = doc.meta
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
    doc = _settings_doc(registry)
    field_meta = doc.meta.get_field(fieldname)
    if not field_meta or field_meta.fieldtype != "Password":
        frappe.throw("Invalid field")
    # A connector with no settings row yet resolves to an unsaved document, and
    # there is no stored secret keyed to a document that was never inserted.
    if doc.is_new():
        return ""
    return doc.get_password(fieldname, raise_exception=False) or ""


@frappe.whitelist()
def save_and_test(connector_id, values):
    """Save connector settings then run the connector's test method."""
    import json

    if isinstance(values, str):
        values = json.loads(values)

    registry = frappe.get_doc("OS Connector Registry", connector_id)
    test_method = registry.test_method

    doc = _settings_doc(registry, for_write=True)
    meta = doc.meta

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


@frappe.whitelist()
def test_connector(connector_id):
    """Run the connector's test_method and update the registry connection status."""
    if not frappe.db.exists("OS Connector Registry", connector_id):
        return {"success": False, "message": "Connector not found"}

    row = frappe.get_doc("OS Connector Registry", connector_id)
    if not row.test_method:
        return {"success": False, "message": "No test method configured"}

    try:
        fn = frappe.get_attr(row.test_method)
        result = fn()
        status = "connected" if result.get("success") else "failed"
    except Exception as e:
        result = {"success": False, "message": str(e)}
        status = "failed"

    frappe.db.set_value("OS Connector Registry", connector_id, {
        "connection_status": status,
        "last_tested_at": frappe.utils.now_datetime(),
    })
    frappe.db.commit()
    return result
