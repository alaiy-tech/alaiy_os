/**
 * AlaiyOS Core — Desk behaviour overrides.
 *
 * Redirects the user from the Desk home (empty route or the
 * default "Home" workspace) straight to the Stock workspace.
 * Runs on every page-change so it catches both the initial
 * load and any manual navigation back to the root.
 */
$(document).on("page-change", function () {
	var route = frappe.get_route_str();
	if (!route || route === "home") {
		frappe.set_route("stock");
	}
});
