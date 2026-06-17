/**
 * AlaiyOS — Shared UI Utilities
 *
 * Loaded after constants/ files in app_include_js, and before
 * route_guard.js and alaiy_settings.js.
 *
 * Depends on (loaded before this file):
 *   constants/route_titles.js  — ALAIY_ROUTE_TITLES, ALAIY_ROUTE_PREFIX_TITLES
 *
 * Exports (window globals, used by route_guard.js and alaiy_settings.js):
 *   updateAlaiyTitle(section)   — sets document.title to the brand format
 *   resolveAlaiySection(route)  — maps a Frappe route string to a section label
 */

// ── Company name helper ───────────────────────────────────────────────────────
// Reads the ERPNext default company from frappe.boot, appends " OS" to form
// the page-title prefix.  e.g. company "Alto Moda" → prefix "Alto Moda OS".
// Falls back to "Alaiy OS" if boot data is not available (e.g. login page).
function _getAlaiyTitlePrefix() {
  const company =
    (frappe.boot &&
      frappe.boot.sysdefaults &&
      frappe.boot.sysdefaults.company) ||
    null;
  return company ? company + " OS" : "Alaiy OS";
}

// ── Title helpers ─────────────────────────────────────────────────────────────

/**
 * Set the browser tab title to:
 *   "<Company> OS — <section> | Alaiy OS"
 *
 * The company name is read live from frappe.boot each time so it stays
 * correct across page loads without a hard-coded constant.
 *
 * @param {string|null} section  e.g. "Stock", "Settings · Selling".
 *   Pass null / undefined to reset to "Dashboard".
 */
// eslint-disable-next-line no-unused-vars
function updateAlaiyTitle(section) {
  const prefix = _getAlaiyTitlePrefix();
  document.title =
    prefix + " \u2014 " + (section || "Dashboard") + " | Alaiy OS";
}

/**
 * Resolve a Frappe route string to an AlaiyOS section label.
 * Called by route_guard.js on every navigation.
 *
 * Uses ALAIY_ROUTE_TITLES and ALAIY_ROUTE_PREFIX_TITLES from
 * constants/route_titles.js (loaded before this file).
 *
 * @param {string} route  frappe.get_route_str() value.
 * @returns {string}
 */
// eslint-disable-next-line no-unused-vars
function resolveAlaiySection(route) {
  if (!route) return "Dashboard";

  // Exact match
  if (ALAIY_ROUTE_TITLES[route]) return ALAIY_ROUTE_TITLES[route];

  // Prefix match (Form/*)
  for (const entry of ALAIY_ROUTE_PREFIX_TITLES) {
    if (route.startsWith(entry.prefix)) return entry.title;
  }

  // Workspace root and settings panel (title managed by alaiy_settings.js)
  if (route.startsWith("alaiy-os")) return "Dashboard";

  return "Alaiy OS";
}
