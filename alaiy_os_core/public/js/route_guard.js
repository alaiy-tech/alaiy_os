// Redirect bare /desk → OS workspace; update page title on route change.
$(document).on("app_ready", function () {
  var path = window.location.pathname;
  var hash = window.location.hash;
  if ((path === "/desk" || path === "/desk/") && (!hash || hash === "#" || hash === "")) {
    // Defer: frappe.router.current_route is null during synchronous app_ready
    setTimeout(function () {
      frappe.set_route("Workspace", ALAIY_OS_WORKSPACE);
    }, 0);
    return;
  }

  frappe.router.on("change", function () {
    var route = frappe.get_route_str ? (frappe.get_route_str() || "") : "";
    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle(resolveAlaiySection(route));
    }
  });
});
