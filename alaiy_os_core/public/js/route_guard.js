/**
 * AlaiyOS Route Guard
 *
 * Intercepts every client-side route change.
 * If the logged-in user is an AlaiyOS user (and not a system admin),
 * any route outside of /app/alaiy-os is immediately redirected back.
 *
 * This is the third layer:
 *   Layer 1 — default_workspace DB field (Frappe v16 redirects on login)
 *   Layer 2 — boot_session hook (filters sidebar in boot data)
 *   Layer 3 — this file (intercepts runtime navigation)
 *
 * IMPORTANT: The handler is registered only after app_ready.
 * Registering on frappe.router "change" at parse time fires during
 * desk.js startup() — before the workspace module is initialised — which
 * causes frappe.set_route("alaiy-os") to hit getpage and return 404.
 * Deferring to app_ready means the guard only runs for user-initiated
 * navigations, not the initial boot sequence.
 *
 * Depends on: alaiy_ui.js (loaded before this file via app_include_js order)
 * Globals used: updateAlaiyTitle(), resolveAlaiySection()
 */
$(document).on("app_ready", function () {
  frappe.router.on("change", function () {
    const bypass = ["System Manager", "Administrator"];
    const roles = frappe.user_roles || [];
    const isAdmin = bypass.some((r) => roles.includes(r));

    if (isAdmin) return;

    const isAlaiy = ["Alaiy OS Manager", "Alaiy OS User"].some((r) =>
      roles.includes(r)
    );
    if (!isAlaiy) return;

    // Block /desk legacy full-page route (not a Frappe SPA route, so use
    // window.location.replace rather than frappe.set_route)
    const path = window.location.pathname || "";
    if (path.startsWith("/desk")) {
      window.location.replace("/app/alaiy-os");
      return;
    }

    const route = frappe.get_route_str() || "";
    // "alaiy-os" covers the workspace and all its in-panel form mounts
    // (settings forms are rendered inside the panel DOM — they do not change the route)
    if (!route.startsWith("alaiy-os")) {
      frappe.set_route("alaiy-os");
      return;
    }

    // Update browser tab title for this route.
    // Functions are defined in alaiy_ui.js which loads before this file.
    if (typeof updateAlaiyTitle === "function") {
      updateAlaiyTitle(resolveAlaiySection(route));
    }
  });
});
