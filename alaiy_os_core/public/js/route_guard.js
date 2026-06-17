/**
 * AlaiyOS Route Guard
 *
 * Confines AlaiyOS users (and not system admins) to the Alaiy OS workspace.
 * Any client-side route outside of `alaiy-os` is redirected back to it, and
 * the legacy /desk page is hard-redirected to /app/alaiy-os.
 *
 * Layers of confinement:
 *   Layer 1 — default_workspace DB field (Frappe v16 redirects on login)
 *   Layer 2 — boot_session hook (filters sidebar in boot data)
 *   Layer 3 — this file (intercepts runtime navigation)
 *
 * Registered only after app_ready so it never fires during desk.js startup()
 * (which would call set_route before the workspace module is initialised and
 * 404 on getpage).
 *
 * Depends on (loaded earlier in app_include_js):
 *   constants/roles.js  — ALAIY_OS_ROLES, ALAIY_OS_BYPASS, ALAIY_OS_ROUTE
 *   alaiy_ui.js         — updateAlaiyTitle(), resolveAlaiySection()
 */
$(document).on("app_ready", function () {
  frappe.router.on("change", function () {
    const roles = frappe.user_roles || [];

    // System admins are never confined.
    if (ALAIY_OS_BYPASS.some((r) => roles.includes(r))) return;

    // Only act for AlaiyOS users.
    if (!ALAIY_OS_ROLES.some((r) => roles.includes(r))) return;

    const route = frappe.get_route_str() || "";
    // frappe.get_route_str() returns "Workspaces/Alaiy OS" when on the workspace,
    // not the "alaiy-os" slug — use the URL path as the reliable check.
    const onAlaiyRoute = window.location.pathname.includes("/" + ALAIY_OS_ROUTE) ||
                         route.startsWith(ALAIY_OS_ROUTE);
    if (!onAlaiyRoute) {
      frappe.set_route(ALAIY_OS_ROUTE);
      return;
    }

    // On the workspace: keep the browser tab title in sync.
    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle(resolveAlaiySection(route));
    }
  });
});
