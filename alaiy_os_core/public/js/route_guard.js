/**
 * AlaiyOS — Route Guard
 *
 * 1. Redirects bare /desk to /desk/os.
 * 2. Updates the workspace page title on navigation.
 *
 * Depends on (loaded earlier in app_include_js):
 *   constants/roles.js       — ALAIY_OS_ROUTE, ALAIY_OS_WORKSPACE
 *   alaiy_ui.js              — updateAlaiyTitle(), resolveAlaiySection()
 */

$(document).on("app_ready", function () {

  // ── Redirect bare /desk → /desk/os ────────────────────────────────────────
  var path = window.location.pathname;
  var hash = window.location.hash;
  // Only redirect if there's no hash route already set (hash route means Frappe
  // is already navigating to a specific page; overriding it causes a crash in
  // store_last_show_sidebar_for_item before the sidebar is initialized).
  if ((path === "/desk" || path === "/desk/") && (!hash || hash === "#" || hash === "")) {
    frappe.set_route(ALAIY_OS_ROUTE);
    return;
  }

  // ── Title update on every route change ────────────────────────────────────
  frappe.router.on("change", function () {
    var route = (frappe.get_route_str && frappe.get_route_str()) || "";
    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle(resolveAlaiySection(route));
    }
  });
});
