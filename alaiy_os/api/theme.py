import frappe


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
