// Sidebar reload fix (github.com/frappe/frappe#36546, #36317):
// Frappe's Sidebar.set_workspace_sidebar() finds every Workspace Sidebar that
// links to the current doctype, then — on a hard reload, when there's no
// "currently active sidebar" in memory to prefer — narrows that list to
// whichever *app* owns the doctype's module (frappe.boot.module_app[module]).
// Item's module ("Stock") is owned by erpnext, so ERPNext's own "Stock"
// sidebar wins over ours even though our "OS" sidebar also links to Item.
// Patch just that narrowing step: if any candidate sidebar belongs to
// alaiy_os, always prefer it over ERPNext/Frappe/HRMS ones. Falls back
// to core behaviour untouched for doctypes we don't have a sidebar entry for.
(function () {
  if (!frappe.ui || !frappe.ui.Sidebar || !frappe.ui.Sidebar.prototype) return;

  const ALAIY_OWN_APP = "alaiy_os";
  const _core_filter_sidebars_from_app =
    frappe.ui.Sidebar.prototype.filter_sidebars_from_app;

  frappe.ui.Sidebar.prototype.filter_sidebars_from_app = function (
    sidebars,
    app,
  ) {
    const own = (sidebars || []).filter(function (sidebar) {
      const meta = frappe.boot.workspace_sidebar_item[sidebar.toLowerCase()];
      return meta && meta.app === ALAIY_OWN_APP;
    });
    if (own.length) return own;
    return _core_filter_sidebars_from_app.call(this, sidebars, app);
  };
})();

// The very first sidebar resolution on a hard reload/direct URL load runs
// before this file has even been fetched (it's an app_include_js script,
// loaded after Frappe's own desk bundle, which resolves the initial route —
// and therefore the initial sidebar — synchronously as soon as it loads).
// That means the patch above, while correct, installs too late to affect
// THAT first call; it only helps subsequent in-session navigations. Fix the
// initial-load race directly: once the app has booted, if the sidebar isn't
// showing one of our own workspaces but one of ours is a valid candidate for
// the current doctype, switch to it.
function alaiyReconcileSidebar() {
  var sidebar = frappe.app && frappe.app.sidebar;
  if (!sidebar || !sidebar.get_workspace_sidebars) return;

  var route = frappe.get_route();
  var doctype = route[0] === "List" || route[0] === "Form" ? route[1] : null;
  if (!doctype) return;

  var current = sidebar.sidebar_title;
  var currentMeta =
    current && frappe.boot.workspace_sidebar_item[current.toLowerCase()];
  if (currentMeta && currentMeta.app === "alaiy_os") return; // already correct

  var candidates = sidebar.get_workspace_sidebars(doctype) || [];
  var own = candidates.find(function (name) {
    var meta = frappe.boot.workspace_sidebar_item[name.toLowerCase()];
    return meta && meta.app === "alaiy_os";
  });
  if (own && own !== current) sidebar.setup(own);
}

// If the browser ever ends up sitting bare on /desk (no workspace slug),
// send it to ALAIY_OS_ROUTE instead. Route by ALAIY_OS_ROUTE (stable) rather
// than workspace name — the Workspace doc itself is renamed to match the
// current company branding.
function redirectBareDeskToHome() {
  if (!ALAIY_OS_ROUTE) return;
  var path = window.location.pathname;
  var hash = window.location.hash;
  if (
    (path === "/desk" || path === "/desk/") &&
    (!hash || hash === "#" || hash === "")
  ) {
    frappe.set_route(ALAIY_OS_ROUTE);
  }
}

// The sidebar's "Desktop" (home) menu item calls frappe.set_route("/desk")
// directly (frappe/public/js/frappe/ui/sidebar/sidebar_header.js). Frappe
// fully renders that bare route -- there's nothing mapped to it, hence the
// "Page not found" flash -- and only AFTER that render does
// router.on("change") fire, which is what redirectBareDeskToHome() above
// reacts to. So on this one known trigger, the user sees "not found" for a
// moment before landing on ALAIY_OS_ROUTE.
//
// Fix it earlier: frappe.router.set_route() normalizes ANY route that means
// "bare desk" (frappe.set_route("/desk"), ("desk"), (""), etc.) down to an
// empty array via get_route_from_arguments() before it ever calls
// push_state()/renders anything. Reuse that exact normalization to catch the
// empty-array case here and substitute ALAIY_OS_ROUTE before the real
// set_route runs -- so the bare route is never pushed to history or rendered
// at all, not just corrected after the fact. This covers every caller that
// goes through frappe.set_route/frappe.router.set_route (the home icon
// today, anything else tomorrow), not just one hardcoded DOM selector.
(function () {
  if (!frappe.router || typeof frappe.router.set_route !== "function") return;
  const _core_set_route = frappe.router.set_route;
  frappe.router.set_route = function (...args) {
    if (ALAIY_OS_ROUTE) {
      const normalized = this.get_route_from_arguments(Array.from(args));
      if (!normalized.length) args = [ALAIY_OS_ROUTE];
    }
    return _core_set_route.apply(this, args);
  };
})();

// Update page title on route change; fall back to OS workspace if desk loads bare.
$(document).on("app_ready", function () {
  alaiyReconcileSidebar();

  frappe.router.on("change", function () {
    setTimeout(alaiyReconcileSidebar, 0);

    var route = frappe.get_route_str ? frappe.get_route_str() || "" : "";
    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle(resolveAlaiySection(route));
    }

    // Safety net for whatever lands on bare /desk WITHOUT going through
    // frappe.set_route (the patch above already catches that) -- e.g. the
    // browser back/forward buttons fire popstate straight into
    // frappe.router.route(), which re-parses window.location directly.
    redirectBareDeskToHome();
  });

  // The very first route resolution on a hard reload/direct URL load runs
  // before this script has even been fetched (app_include_js loads after
  // Frappe's own desk bundle, which resolves the initial route -- and fires
  // its own first "change" trigger -- synchronously as soon as it loads), so
  // the listener above installs too late to catch THAT one. Covered here
  // instead, with a short wait so this doesn't double-navigate if Frappe's
  // own auto-navigate-to-first-workspace already moved on by the time this
  // runs.
  setTimeout(redirectBareDeskToHome, 150);
});
