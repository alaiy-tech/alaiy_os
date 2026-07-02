// Update page title on route change; fall back to OS workspace if desk loads bare.
$(document).on("app_ready", function () {
  frappe.router.on("change", function () {
    var route = frappe.get_route_str ? (frappe.get_route_str() || "") : "";
    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle(resolveAlaiySection(route));
    }
  });

  if (!ALAIY_OS_ROUTE) return;

  var path = window.location.pathname;
  var hash = window.location.hash;
  if ((path === "/desk" || path === "/desk/") && (!hash || hash === "#" || hash === "")) {
    // Frappe auto-navigates to the first sidebar workspace on bare /desk.
    // Wait briefly so we don't double-navigate if Frappe already moved on.
    // Route by ALAIY_OS_ROUTE (stable) rather than workspace name — the
    // Workspace doc itself is renamed to match the current company branding.
    setTimeout(function () {
      var cur = window.location.pathname;
      if (cur === "/desk" || cur === "/desk/") {
        frappe.set_route(ALAIY_OS_ROUTE);
      }
    }, 150);
  }
});
