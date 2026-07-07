// Sidebar reload fix (github.com/frappe/frappe#36546, #36317):
// Frappe's Sidebar.set_workspace_sidebar() finds every Workspace Sidebar that
// links to the current doctype, then — on a hard reload, when there's no
// "currently active sidebar" in memory to prefer — narrows that list to
// whichever *app* owns the doctype's module (frappe.boot.module_app[module]).
// Item's module ("Stock") is owned by erpnext, so ERPNext's own "Stock"
// sidebar wins over ours even though our "OS" sidebar also links to Item.
// Patch just that narrowing step: if any candidate sidebar belongs to
// alaiy_os_core, always prefer it over ERPNext/Frappe/HRMS ones. Falls back
// to core behaviour untouched for doctypes we don't have a sidebar entry for.
(function () {
  if (!frappe.ui || !frappe.ui.Sidebar || !frappe.ui.Sidebar.prototype) return;

  const ALAIY_OWN_APP = "alaiy_os_core";
  const _core_filter_sidebars_from_app =
    frappe.ui.Sidebar.prototype.filter_sidebars_from_app;

  frappe.ui.Sidebar.prototype.filter_sidebars_from_app = function (sidebars, app) {
    const own = (sidebars || []).filter(function (sidebar) {
      const meta = frappe.boot.workspace_sidebar_item[sidebar.toLowerCase()];
      return meta && meta.app === ALAIY_OWN_APP;
    });
    if (own.length) return own;
    return _core_filter_sidebars_from_app.call(this, sidebars, app);
  };
})();

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
