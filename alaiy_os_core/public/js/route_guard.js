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
  if (path === "/desk" || path === "/desk/") {
    window.location.href = "/desk/" + ALAIY_OS_ROUTE;
    return;
  }

  // ── Title update + navbar re-injection on every route change ─────────────
  // Frappe v16 replaces the page-head DOM on each navigation, so the custom
  // nav button must be re-injected after the route settles.
  frappe.router.on("change", function () {
    var route = (frappe.get_route_str && frappe.get_route_str()) || "";
    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle(resolveAlaiySection(route));
    }
    // Re-inject after a short delay to let Frappe render the new page-head
    setTimeout(function () {
      if (typeof _injectCustomNavbar === "function") {
        _injectCustomNavbar();
      }
    }, 300);
  });
});
