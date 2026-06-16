/* =========================================================
   AlaiyOS Core — Client-side route guard.

   PURPOSE
   Block non-System-Administrators from navigating to DocTypes
   and Reports that AlaiyOS has hidden, even via a direct URL or
   a stale bookmark (e.g. /desk/stock-entry or
   /desk/query-report/Stock%20Projected%20Qty).

   HOW
   The server injects `frappe.boot.blocked_routes` for non-admin
   users only — admins get an empty list (see boot.py
   inject_branding_and_restrictions). Each entry is either:
     * a DocType slug             -> "stock-entry"
     * a report route             -> "query-report/Stock Projected Qty"
   On every route change we compare the current route against the
   list; on a match we redirect the user to the Stock workspace
   instead of letting the blocked page render.

   SAFE TO LOAD EVERYWHERE
   All access is defensive (guards everywhere) so this never throws
   on pages where frappe.router / boot aren't ready, and never on
   non-DocType / non-Report routes.
   ========================================================= */

frappe.provide("alaiy_os_core.route_guard");

(function () {
  "use strict";

  // Where blocked users are sent. The workspace route slug for "Stock".
  var SAFE_ROUTE = "stock";

  // Normalise any name to Frappe's route slug, e.g. "Stock Entry" -> "stock-entry".
  function slugify(name) {
    return String(name || "")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  // Read the server-injected block list. Empty for admins / when unset.
  // We split it into two buckets for cheap matching.
  function blockedSets() {
    var list = (frappe.boot && frappe.boot.blocked_routes) || [];
    var doctypeSlugs = {};
    var reportNames = {};
    list.forEach(function (entry) {
      entry = String(entry || "");
      if (entry.toLowerCase().indexOf("query-report/") === 0) {
        // Store the report name lower-cased for case-insensitive compare.
        reportNames[entry.slice("query-report/".length).toLowerCase()] = true;
      } else {
        doctypeSlugs[entry.toLowerCase()] = true;
      }
    });
    return { doctypes: doctypeSlugs, reports: reportNames };
  }

  // True if the user is a System Administrator — never block them.
  // boot already sends an empty list for admins; this is a second layer.
  function isAdmin() {
    try {
      return (
        (frappe.user_roles &&
          frappe.user_roles.indexOf("System Manager") !== -1) ||
        (frappe.user && frappe.user.has_role("System Manager")) ||
        frappe.session.user === "Administrator"
      );
    } catch (e) {
      return false;
    }
  }

  // Decide whether the current route is blocked.
  // route examples from frappe.get_route():
  //   ["List", "stock-entry", "List"]            (list view)
  //   ["Form", "stock-entry", "NEW-..."]         (form view)
  //   ["query-report", "Stock Projected Qty"]    (report view)
  function isBlockedRoute(route, sets) {
    if (!route || !route.length) return false;
    var first = String(route[0] || "").toLowerCase();

    // Report routes.
    if (first === "query-report" && route[1]) {
      // route[1] may be URL-decoded already by frappe; normalise spaces.
      var reportName = decodeURIComponent(String(route[1])).toLowerCase();
      return !!sets.reports[reportName];
    }

    // DocType list/form/tree/report-builder routes — route[1] is the slug.
    if (
      ["list", "form", "tree", "report", "dashboard-view"].indexOf(first) !== -1
    ) {
      var slug = slugify(route[1]);
      return !!sets.doctypes[slug];
    }

    return false;
  }

  // Send the blocked user to the Stock workspace with a brief notice.
  function redirectToStock() {
    try {
      frappe.show_alert(
        {
          message: __("This feature is not available."),
          indicator: "orange",
        },
        3,
      );
    } catch (e) {
      /* show_alert may not be ready on very early loads — ignore */
    }
    frappe.set_route(SAFE_ROUTE);
  }

  // Core check: if the current route is blocked, redirect to Stock.
  alaiy_os_core.route_guard.check = function () {
    if (isAdmin()) return; // admins unaffected

    var sets = blockedSets();
    var route = (frappe.get_route && frappe.get_route()) || [];

    if (isBlockedRoute(route, sets)) {
      redirectToStock();
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
