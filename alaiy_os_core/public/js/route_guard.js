/**
 * AlaiyOS Route Guard
 *
 * Confines AlaiyOS users (not system admins) to the Alaiy OS workspace.
 * Any client-side route outside the workspace is redirected back to it,
 * and the legacy /desk page is hard-redirected to /app/os.
 *
 * Layers of confinement:
 *   Layer 1 — role_home_page hook   (Frappe redirects on login by role)
 *   Layer 2 — default_workspace     (Frappe v16 per-user workspace setting)
 *   Layer 3 — boot_session hook     (filters sidebar in boot data)
 *   Layer 4 — this file             (intercepts runtime navigation)
 *
 * Sub-route support (/app/os/<slug>):
 *   Clicking a sidebar item updates the URL via history.pushState to
 *   /app/os/<slug>.  If Frappe's router fires a change for that path
 *   (e.g. on page refresh), this guard captures it, stores the slug in
 *   sessionStorage, and redirects to the workspace root.  alaiy_workspace.js
 *   listens for page-change on the workspace and opens the overlay.
 *
 * Depends on (loaded earlier in app_include_js):
 *   constants/roles.js  — ALAIY_OS_ROLES, ALAIY_OS_BYPASS,
 *                         ALAIY_OS_ROUTE, ALAIY_OS_WORKSPACE
 *   alaiy_ui.js         — updateAlaiyTitle(), resolveAlaiySection()
 */

$(document).on("app_ready", function () {
  frappe.router.on("change", function () {
    const roles = frappe.user_roles || [];
    if (ALAIY_OS_BYPASS.some((r) => roles.includes(r))) return;
    if (!ALAIY_OS_ROLES.some((r) => roles.includes(r))) return;

    const route = (frappe.get_route_str && frappe.get_route_str()) || "";
    const path  = window.location.pathname;

    // ── Sub-route: /app/os/<slug> or /desk/os/<slug> ──────────────────────
    // Frappe might try to render "os/stock-entry" as an unknown page.
    // Intercept: store the slug, redirect to workspace root so Frappe renders
    // the workspace correctly.  alaiy_workspace.js picks up the slug on
    // the next page-change event.
    // Support both /app/ and /desk/ URL bases (Frappe version dependent).
    const OS_BASES = ["/app/" + ALAIY_OS_ROUTE, "/desk/" + ALAIY_OS_ROUTE];

    for (var i = 0; i < OS_BASES.length; i++) {
      const base = OS_BASES[i];
      if (path.startsWith(base + "/")) {
        const slug = path.slice(base.length + 1);
        if (slug) sessionStorage.setItem("alaiy_pending_subroute", slug);
        frappe.set_route("Workspaces", ALAIY_OS_WORKSPACE);
        return;
      }
    }

    // ── Primary check: URL path (immune to title/name mismatches) ─────────
    const onAlaiyRoute =
      OS_BASES.some(function (base) { return path === base || path.startsWith(base + "/"); }) ||
      route === "Workspaces/" + ALAIY_OS_WORKSPACE;

    if (!onAlaiyRoute) {
      frappe.set_route("Workspaces", ALAIY_OS_WORKSPACE);
      return;
    }

    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle(resolveAlaiySection(route));
    }
  });
});
