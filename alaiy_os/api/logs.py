import frappe

# The hook every app registers its log doctype with. setup/install.py builds the
# desk sidebar's Logs section from the same list - the custom UI reads it here so
# a newly installed connector appears on both without a change in either.
LOG_ITEMS_HOOK = "alaiy_os_sidebar_log_items"

DEFAULT_ICON = "activity"


@frappe.whitelist()
def get_log_sources():
	"""The log doctypes this user can actually read, for the Settings > Logs page.

	Only `DocType` entries are returned. The hook also accepts `Page` targets -
	those are a desk page and nothing a generic table can render, so they are
	skipped rather than handed to a frontend that would have to special-case
	them.

	Permission is checked per doctype instead of once for the page: the log
	doctypes ship their own roles (SP-API Log grants Amazon Manager and Amazon
	Viewer), so a user who can read one connector's log will often not be able to
	read another's, and the page should show them the one they can.
	"""
	sources = []
	seen = set()

	for hook_entries in frappe.get_hooks(LOG_ITEMS_HOOK):
		for entry in hook_entries if isinstance(hook_entries, list) else [hook_entries]:
			if entry.get("link_type", "DocType") != "DocType":
				continue

			doctype = (entry.get("link_to") or "").strip()
			if not doctype or doctype in seen:
				continue
			if not frappe.db.exists("DocType", doctype):
				continue
			if not frappe.has_permission(doctype, "read"):
				continue

			seen.add(doctype)
			sources.append({
				"doctype": doctype,
				"label": entry.get("label") or doctype,
				"icon": entry.get("icon") or DEFAULT_ICON,
			})

	# Stable order regardless of app install order, so the page doesn't reshuffle
	# its picker when an unrelated connector is added.
	sources.sort(key=lambda source: source["label"].lower())
	return sources
