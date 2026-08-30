import frappe
from frappe.utils.file_manager import save_file

_LOGO_FIELD_BY_TYPE = {"square": "square_logo", "horizontal": "horizontal_logo"}


@frappe.whitelist()
def upload_organisation_logo(logo_type):
	"""Attaches an uploaded square/horizontal logo to the shared OS Theme
	Settings singleton and saves it, so that doctype's own on_update hook
	(_apply_logos) copies the file into the site's shared assets folder as
	client-logo-square.png / client-logo-hor.png - the exact mechanism the
	desk Theme Settings form's own logo fields already use, so this endpoint
	and that form can never drift out of sync on what the live logo is.
	"""
	if logo_type not in _LOGO_FIELD_BY_TYPE:
		frappe.throw(frappe._("Invalid logo type."))
	if not frappe.has_permission("OS Theme Settings", "write"):
		frappe.throw(frappe._("You do not have permission to update the organisation logos"), frappe.PermissionError)

	uploaded = frappe.request.files.get("file")
	if not uploaded:
		frappe.throw(frappe._("No file uploaded."))

	settings = frappe.get_single("OS Theme Settings")
	file_doc = save_file(uploaded.filename, uploaded.stream.read(), "OS Theme Settings", settings.name, is_private=0)
	settings.set(_LOGO_FIELD_BY_TYPE[logo_type], file_doc.file_url)
	settings.save(ignore_permissions=True)
	frappe.db.commit()
	return {"file_url": file_doc.file_url}


@frappe.whitelist(allow_guest=True)
def custom_theme_css():
	"""
	Serve the OS Theme Settings CSS live, computed fresh on every request.

	The static asset at /assets/alaiy_os/css/custom.css is served with a long
	Cache-Control (max-age=43200) and a version query string that never
	changes between saves, so browsers kept the previous theme cached and a
	Save never visibly took effect. Routing app_include_css at this whitelisted
	method instead means every full page load re-reads OS Theme Settings and
	returns the current CSS (or nothing, if Enable Custom Theme is off) with
	no-cache headers, so edits and the enable/disable toggle apply on the very
	next reload.
	"""
	settings = frappe.get_single("OS Theme Settings")
	css = settings.build_css() if settings.enable_custom_theme else ""

	frappe.response["type"] = "download"
	frappe.response["filename"] = "custom.css"
	frappe.response["filecontent"] = css
	frappe.response["content_type"] = "text/css"
	frappe.response["display_content_as"] = "inline"
	frappe.local.response_headers["Cache-Control"] = "no-cache, must-revalidate"
