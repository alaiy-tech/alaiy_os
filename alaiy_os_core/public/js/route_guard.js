/**
 * AlaiyOS Route Guard
 *
 * Intercepts every client-side route change.
 * If the logged-in user is an AlaiyOS user (and not a system admin),
 * any route outside of /app/alaiy-os is immediately redirected back.
 *
 * This is the third layer:
 *   Layer 1 — home_page DB field (redirects on login)
 *   Layer 2 — boot_session hook (filters sidebar in boot data)
 *   Layer 3 — this file (intercepts runtime navigation)
 */
frappe.router.on("change", function () {
  const bypass = ["System Manager", "Administrator"];
  const roles = frappe.user_roles || [];
  const isAdmin = bypass.some((r) => roles.includes(r));

  if (isAdmin) return;

  const isAlaiy = ["Alaiy OS Manager", "Alaiy OS User"].some((r) =>
    roles.includes(r),
  );
  if (!isAlaiy) return;

  const route = frappe.get_route_str() || "";
  // "alaiy-os" covers the workspace and all its in-panel form mounts
  // (settings forms are rendered inside the panel DOM — they do not change the route)
  if (!route.startsWith("alaiy-os")) {
    frappe.set_route("alaiy-os");
  }
});
