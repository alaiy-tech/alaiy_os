/**
 * AlaiyOS — Route Title Updater
 *
 * Updates the workspace page title as the user navigates within the overlay.
 * No confinement — all users can navigate freely.
 *
 * Depends on (loaded earlier in app_include_js):
 *   constants/roles.js       — ALAIY_OS_ROUTE, ALAIY_OS_WORKSPACE
 *   alaiy_ui.js              — updateAlaiyTitle(), resolveAlaiySection()
 */

$(document).on("app_ready", function () {
  frappe.router.on("change", function () {
    const route = (frappe.get_route_str && frappe.get_route_str()) || "";

    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle(resolveAlaiySection(route));
    }
  });
});
