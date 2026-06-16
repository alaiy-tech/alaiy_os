/* =========================================================
   AlaiyOS Core — UI overrides (ERPNext 16 / Frappe v15+).

   Loaded on every Desk page via app_include_js (hooks.py).

   Responsibilities (all config-driven via frappe.boot, injected
   by boot.inject_branding_and_restrictions):

     1. Onboarding panel — hide the "Getting Started" (.onb-panel)
        widget when frappe.boot.hide_onboarding is true.
     2. Default route — redirect the bare desk root to the
        configured default workspace when show_desk_homepage=false.
     3. Topbar widgets — move the Search (Ctrl+K) trigger and the
        Notifications bell out of the sidebar and into the navbar
        (right side), since ERPNext 16 renders them in the sidebar.

   SAFE TO LOAD EVERYWHERE
   Everything is guarded and idempotent — re-running on every
   page-change never duplicates elements or throws.
   ========================================================= */

frappe.provide("alaiy_os_core.ui");

(function () {
  "use strict";

  // ── 1. Hide the onboarding / "Getting Started" panel ───────────────────────
  function hideOnboarding() {
    if (!(frappe.boot && frappe.boot.hide_onboarding)) return;
    // ERPNext 16 onboarding widget + its status strip.
    $(
      ".onb-panel, .onboarding-widget-box, .ws-onboarding, .onboarding-status",
    ).hide();
  }

  // ── 2. Redirect the bare desk root to the default workspace ────────────────
  function redirectDefaultRoute() {
    if (frappe.boot && frappe.boot.show_desk_homepage) return; // homepage allowed

    var route = (frappe.get_route && frappe.get_route()) || [];
    var isRoot =
      !route.length ||
      (route.length === 1 && (route[0] === "" || route[0] === "Workspaces"));

    if (isRoot) {
      var target = (frappe.boot && frappe.boot.default_route) || "stock";
      // Avoid a redirect loop if we're already heading there.
      if (frappe.get_route_str() !== target) {
        frappe.set_route(target);
      }
    }
  }

  // ── 3. Move Search + Notifications into the navbar (right side) ─────────────
  // ERPNext 16 puts these in the sidebar header. We relocate the actual DOM
  // nodes into the navbar's right-hand <ul> so no core files are touched.
  function moveTopbarWidgets() {
    var $navbarRight = $(
      ".navbar .navbar-nav.d-flex, .navbar .navbar-collapse .navbar-nav",
    ).last();
    if (!$navbarRight.length) {
      $navbarRight = $(".navbar .container > .navbar-nav").last();
    }
    if (!$navbarRight.length) return; // navbar not ready yet

    // --- Search trigger (the sidebar "Search Ctrl+K" affordance). ---
    var $search = $(
      ".sidebar-search, .body-sidebar .search-bar, .standard-sidebar .sidebar-search",
    ).first();
    if ($search.length && !$search.data("alaiy-moved")) {
      var $searchLi = $('<li class="nav-item alaiy-navbar-search"></li>');
      $searchLi.append($search);
      $search.data("alaiy-moved", true);
      $navbarRight.prepend($searchLi);
    }

    // --- Notifications bell. ---
    var $notif = $(
      ".notifications-list .dropdown, .navbar-notifications, .sidebar .notifications, .body-sidebar .notifications",
    ).first();
    if ($notif.length && !$notif.data("alaiy-moved")) {
      var $notifLi = $('<li class="nav-item alaiy-navbar-notif"></li>');
      $notifLi.append($notif);
      $notif.data("alaiy-moved", true);
      $navbarRight.prepend($notifLi);
    }
  }

  // ── Run all overrides for the current page ─────────────────────────────────
  alaiy_os_core.ui.apply = function () {
    try {
      hideOnboarding();
    } catch (e) {
      /* non-fatal */
    }
    try {
      moveTopbarWidgets();
    } catch (e) {
      /* non-fatal */
    }
  };

  // page-change fires after each SPA navigation (sidebar may re-render).
  $(document).on("page-change", function () {
    alaiy_os_core.ui.apply();
    // Defer once more: ERPNext 16 renders the onboarding widget async.
    setTimeout(alaiy_os_core.ui.apply, 300);
  });

  // Default-route redirect must hook the router so it fires on the very first
  // navigation as well as subsequent ones.
  function bindRouter() {
    if (frappe.router && frappe.router.on) {
      frappe.router.on("change", redirectDefaultRoute);
    }
    redirectDefaultRoute();
  }

  $(document).on("app_ready", function () {
    bindRouter();
    alaiy_os_core.ui.apply();
  });

  // Fallback if app_ready already fired before this script loaded.
  if (typeof frappe !== "undefined" && frappe.router) {
    bindRouter();
  }
})();
