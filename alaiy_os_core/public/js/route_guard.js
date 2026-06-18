/**
 * AlaiyOS — Route Guard
 *
 * 1. Redirects bare /desk to /desk/Workspaces/OS.
 * 2. Updates the workspace page title on navigation.
 * 3. Collapses sidebar sections by default on workspace load.
 *
 * Depends on (loaded earlier in app_include_js):
 *   constants/roles.js       — ALAIY_OS_ROUTE, ALAIY_OS_WORKSPACE
 *   alaiy_ui.js              — updateAlaiyTitle(), resolveAlaiySection()
 */

$(document).on("app_ready", function () {

  // ── Redirect bare /desk → /desk/Workspaces/OS ──────────────────────────────
  var path = window.location.pathname;
  if (path === "/desk" || path === "/desk/") {
    frappe.set_route("Workspaces", ALAIY_OS_WORKSPACE);
  }

  // ── Title update on every route change ────────────────────────────────────
  frappe.router.on("change", function () {
    var route = (frappe.get_route_str && frappe.get_route_str()) || "";
    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle(resolveAlaiySection(route));
    }
  });

  // ── Collapse sidebar sections by default ───────────────────────────────────
  // Frappe renders section items open. We close them after page-change so
  // each section header starts collapsed and expands on click.
  function _collapseSidebarSections() {
    // Child containers (the nested items under a section header)
    $(".sidebar-item-container.section-item .sidebar-child-item.nested-container").each(function () {
      $(this).hide();
    });
    // Flip the chevron button state to indicate collapsed
    $(".sidebar-item-container.section-item .drop-icon[data-state='opened']").each(function () {
      $(this).attr("data-state", "closed");
      $(this).find("use").attr("href", "#icon-chevron-right");
    });
  }

  // Run on every page-change (workspace re-renders sidebar)
  $(document).on("page-change", function () {
    setTimeout(_collapseSidebarSections, 100);
  });

  // Run once on app_ready for the initial render
  setTimeout(_collapseSidebarSections, 300);
});
