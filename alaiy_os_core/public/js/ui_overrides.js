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

/* ── 0. Null-safe Container.toggle_sidebar (TOP-LEVEL, runs synchronously) ──
   This file is parsed before $(document).ready() fires, so the patch is in
   place when frappe.Application.startup() runs inside the ready callback.

   frappe.views.Container.toggle_sidebar() is called during set_route() in
   startup(). If frappe.container.sidebar hasn't been wired yet the call
   throws, which propagates through the Application constructor and leaves
   frappe.app as a plain {} (the assignment never completes). Making it a
   no-op when sidebar is not yet wired lets Application fully initialise.    */
(function () {
  if (
    frappe.views &&
    frappe.views.Container &&
    frappe.views.Container.prototype &&
    typeof frappe.views.Container.prototype.toggle_sidebar === "function"
  ) {
    var _origToggle = frappe.views.Container.prototype.toggle_sidebar;
    frappe.views.Container.prototype.toggle_sidebar = function (show) {
      if (!this.sidebar) return; // not wired yet — skip silently
      return _origToggle.call(this, show);
    };
  }
})();

(function () {
  "use strict";

  // ── 1. Hide the onboarding / "Getting Started" panel ───────────────────────
  function hideOnboarding() {
    if (!(frappe.boot && frappe.boot.hide_onboarding)) return;
    $(
      ".onb-panel, .onboarding-widget-box, .ws-onboarding, .onboarding-status",
    ).hide();
  }

  // ── 2. Redirect the bare desk root to the default workspace ────────────────
  function redirectDefaultRoute() {
    if (frappe.boot && frappe.boot.show_desk_homepage) return;

    var route = (frappe.get_route && frappe.get_route()) || [];
    var isRoot =
      !route.length ||
      (route.length === 1 && (route[0] === "" || route[0] === "Workspaces"));

    if (isRoot) {
      var target = (frappe.boot && frappe.boot.default_route) || "stock";
      var current = "";
      try { current = frappe.get_route_str() || ""; } catch (e) { /* not ready */ }
      if (current !== target) {
        frappe.set_route(target);
      }
    }
  }

  // ── 3. Move Search + Notifications into the navbar (right side) ─────────────
  function moveTopbarWidgets() {
    var $navbarRight = $(
      ".navbar .navbar-nav.d-flex, .navbar .navbar-collapse .navbar-nav",
    ).last();
    if (!$navbarRight.length) {
      $navbarRight = $(".navbar .container > .navbar-nav").last();
    }
    if (!$navbarRight.length) return;

    var $search = $(
      ".sidebar-search, .body-sidebar .search-bar, .standard-sidebar .sidebar-search",
    ).first();
    if ($search.length && !$search.data("alaiy-moved")) {
      var $searchLi = $('<li class="nav-item alaiy-navbar-search"></li>');
      $searchLi.append($search);
      $search.data("alaiy-moved", true);
      $navbarRight.prepend($searchLi);
    }

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

  // ── 4. Sidebar recovery ────────────────────────────────────────────────────
  // With the Container.toggle_sidebar patch above, frappe.Application should
  // now complete its startup and set frappe.app.sidebar correctly. This
  // function is a belt-and-suspenders fallback only.
  //
  // IMPORTANT: only create a new Sidebar if .body-sidebar does NOT already
  // exist in the DOM. Application always creates one in make_sidebar(); if we
  // create a second one there are two sidebar panels visible.
  function ensureSidebar() {
    if (frappe.app && frappe.app.sidebar) return; // already initialised
    if (!frappe.ui || typeof frappe.ui.Sidebar !== "function") return;
    // Don't create a second sidebar DOM if Application already made one.
    if (document.querySelector(".body-sidebar")) return;
    try {
      var sidebar = new frappe.ui.Sidebar({});
      if (frappe.app) frappe.app.sidebar = sidebar;
    } catch (e) {
      /* non-fatal */
    }
  }

  // ── Run all overrides for the current page ─────────────────────────────────
  alaiy_os_core.ui.apply = function () {
    try { hideOnboarding(); } catch (e) { /* non-fatal */ }
    try { moveTopbarWidgets(); } catch (e) { /* non-fatal */ }
    // If workspace loaded before sidebar was wired, re-wire and trigger setup.
    try {
      if (
        frappe.workspace &&
        !frappe.workspace.sidebar &&
        frappe.app &&
        frappe.app.sidebar
      ) {
        frappe.workspace.sidebar = frappe.app.sidebar;
        if (typeof frappe.workspace.setup_sidebar === "function") {
          frappe.workspace.setup_sidebar();
        }
      }
    } catch (e) { /* non-fatal */ }
  };

  $(document).on("page-change", function () {
    alaiy_os_core.ui.apply();
    setTimeout(alaiy_os_core.ui.apply, 300);
  });

  function bindRouter() {
    if (frappe.router && frappe.router.on) {
      frappe.router.on("change", redirectDefaultRoute);
    }
    redirectDefaultRoute();
  }

  $(document).on("app_ready", function () {
    ensureSidebar();
    bindRouter();
    alaiy_os_core.ui.apply();
  });

  // frappe.router is set synchronously in desk.bundle before $(document).ready.
  // Only wire the change handler here — do NOT call redirectDefaultRoute()
  // directly, as frappe.get_route_str() may throw at this early stage.
  if (typeof frappe !== "undefined" && frappe.router && frappe.router.on) {
    frappe.router.on("change", redirectDefaultRoute);
  }
})();
