import frappe


@frappe.whitelist()
def get_preferences():
	"""All of the current user's OS User Preference rows in one call - meant
	to be fetched once on login rather than one request per setting key."""
	rows = frappe.get_all(
		"OS User Preference",
		filters={"user": frappe.session.user},
		fields=["context_key", "value"],
	)
	return {row.context_key: row.value for row in rows}


@frappe.whitelist()
def set_preference(context_key, value):
	"""Upserts a single preference row for the current session user.

	Never accepts a user param from the client - frappe.session.user is the
	only source of truth for whose row this is, so a user can only ever
	write their own preferences. `value` is stored as-is (opaque to this
	doctype - the frontend owns the JSON shape).
	"""
	existing = frappe.db.get_value(
		"OS User Preference", {"user": frappe.session.user, "context_key": context_key}, "name"
	)
	if existing:
		doc = frappe.get_doc("OS User Preference", existing)
		doc.value = value
		doc.save()
	else:
		doc = frappe.get_doc({
			"doctype": "OS User Preference",
			"user": frappe.session.user,
			"context_key": context_key,
			"value": value,
		})
		doc.insert()
	frappe.db.commit()
	return {"ok": True}
