/* =========================================================
   AlaiyOS Core — Client-side route guard.

   PURPOSE
   Block non-System-Administrators from navigating to DocTypes
   that AlaiyOS has hidden from the UI (e.g. /app/stock-entry),
   even via direct URL or a stale bookmark.

   HOW
   The server injects `frappe.boot.blocked_doctypes` (a list of
   DocType names) for non-admin users only — admins get an empty
   list (see boot.inject_branding_and_restrictions). On every
   route change we compare the target DocType against that list;
   if it matches, we cancel navigation and show a clean message
   instead of a broken/empty page.

   SAFE TO LOAD EVERYWHERE
   All access is defensive (optional chaining / guards) so this
   never throws on pages where frappe.router or boot aren't ready.
   ========================================================= */

frappe.provide("alaiy_os_core.route_guard");

(function () {
  "use strict";

  // Normalise a DocType name to the slug Frappe uses in routes,
  // e.g. "Stock Entry" -> "stock-entry".
  function slugify(doctype) {
    return String(doctype || "")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  // Read the server-injected block list. Empty for admins / when unset.
  function blockedSlugs() {
    var list = (frappe.boot && frappe.boot.blocked_doctypes) || [];
    return list.map(slugify);
  }

  // True if the user is a System Administrator — never block them.
  // boot already sends an empty list for admins; this is a second layer.
  function isAdmin() {
    try {
      return (
        frappe.user.has_role("System Manager") ||
        frappe.session.user === "Administrator"
      );
    } catch (e) {
      return false;
    }
  }

  // Extract the DocType slug from a route array.
  // Frappe routes look like: ["List","Stock Entry"] -> handled by frappe core
  // as a slug already in the URL. We inspect frappe.get_route():
  //   ["List", "stock-entry", "List"]  (list view)
  //   ["Form", "stock-entry", "NEW..."] (form view)
  function targetSlugFromRoute(route) {
    if (!route || !route.length) return null;
    var first = String(route[0] || "").toLowerCase();
    if (["list", "form", "tree", "report", "dashboard-view"].indexOf(first) === -1) {
      return null;
    }
    // route[1] is the doctype slug for these view types.
    return slugify(route[1]);
  }

  // Show a clean, dismissible "not available" message.
  function denyAccess() {
    frappe.msgprint({
      title: __("Not Available"),
      indicator: "orange",
      message: __(
        "This feature is not available in your workspace. " +
          "Please contact your administrator if you need access.",
      ),
    });
  }

  // Send the user somewhere safe (their first visible workspace, else /app).
  function redirectHome() {
    var ws =
      (frappe.boot &&
        frappe.boot.alaiy_config &&
        frappe.boot.alaiy_config.visible_workspaces &&
        frappe.boot.alaiy_config.visible_workspaces[0]) ||
      null;
    if (ws) {
      frappe.set_route(ws.toLowerCase());
    } else {
      frappe.set_route("/app");
    }
  }

  // Core check: if the current route targets a blocked DocType, deny + redirect.
  alaiy_os_core.route_guard.check = function () {
    if (isAdmin()) return; // admins unaffected

    var blocked = blockedSlugs();
    if (!blocked.length) return;

    var route = (frappe.get_route && frappe.get_route()) || [];
    var slug = targetSlugFromRoute(route);
    if (!slug) return;

    if (blocked.indexOf(slug) !== -1) {
      denyAccess();
      redirectHome();
    }
  };

  // Wire to Frappe's router. `change` fires after every SPA navigation.
  function bind() {
    if (frappe.router && frappe.router.on) {
      frappe.router.on("change", alaiy_os_core.route_guard.check);
    }
    // Also run once on initial load in case we landed directly on a blocked URL.
    alaiy_os_core.route_guard.check();
  }

  // frappe.router may not exist until app_ready; guard accordingly.
  if (typeof frappe !== "undefined") {
    $(document).on("app_ready", bind);
    // Fallback if app_ready already fired.
    if (frappe.router) {
      bind();
    }
  }
})();
