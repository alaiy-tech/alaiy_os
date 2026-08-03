import frappe

# Layout/structural fieldtypes carry no data of their own - never useful as a
# column, filter, sort, or bulk-edit target.
_LAYOUT_FIELDTYPES = {"Section Break", "Column Break", "Tab Break", "HTML", "Button"}
# Child tables aren't renderable as a single cell value. Password must never
# be offered as a column/filter/sort/bulk-edit target - this is a security
# boundary, not a formatting choice.
_EXCLUDED_FIELDTYPES = _LAYOUT_FIELDTYPES | {"Table", "Table MultiSelect", "Password"}


@frappe.whitelist()
def get_doctype_fields(doctype):
    """Clean, permission-safe field metadata for the frontend's generic list
    toolbar (columns/filters/sort/bulk-edit).

    Deliberately not calling frappe.desk.form.load.getdoctype - that's a
    desk-internal endpoint whose response shape backs desk's own client-side
    meta cache and isn't a stable public API. This wraps frappe.get_meta
    directly so the response shape is ours to control.
    """
    if not frappe.has_permission(doctype, "read"):
        frappe.throw(frappe._("You do not have permission to view {0}").format(doctype), frappe.PermissionError)

    meta = frappe.get_meta(doctype)

    fields = []
    for f in meta.fields:
        if f.fieldtype in _EXCLUDED_FIELDTYPES:
            continue
        fields.append({
            "fieldname": f.fieldname,
            "label": f.label or f.fieldname,
            "fieldtype": f.fieldtype,
            "options": f.options,
            "read_only": bool(f.read_only),
            "unique": bool(f.unique),
            "permlevel": f.permlevel or 0,
            "in_list_view": bool(f.in_list_view),
        })

    return {
        "fields": fields,
        "autoname": meta.autoname,
        "can_write": bool(frappe.has_permission(doctype, "write")),
        "can_delete": bool(frappe.has_permission(doctype, "delete")),
    }
