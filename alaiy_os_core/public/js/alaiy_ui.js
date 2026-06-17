/**
 * AlaiyOS — Shared UI Utilities
 *
 * Loaded FIRST in app_include_js so that route_guard.js and
 * alaiy_settings.js can reference the globals defined here.
 *
 * Exports (to the global window scope, intentionally):
 *   ALAIY_ROUTE_TITLES          — exact-match route → section name
 *   ALAIY_ROUTE_PREFIX_TITLES   — prefix-match for Form/* routes
 *   updateAlaiyTitle(section)   — sets document.title to the brand format
 */

// ── Brand title constants ─────────────────────────────────────────────────────
const ALAIY_TITLE_PREFIX = "Alto Moda OS";

// ── Exact-match route → section name ─────────────────────────────────────────
// Keys are frappe.get_route_str() values.
const ALAIY_ROUTE_TITLES = {
  // Workspace root (both the raw route and with trailing slash)
  "alaiy-os": "Dashboard",

  // Stock
  "List/Stock Entry/List": "Stock",
  "List/Item/List": "Stock",
  "List/Item Group/List": "Stock",
  "List/Item Attribute/List": "Stock",
  "List/Item Price/List": "Stock",
  "List/Item Variant Attribute/List": "Stock",
  "List/Brand/List": "Stock",
  "List/Stock Reconciliation/List": "Stock",
  "List/Purchase Receipt/List": "Stock · Purchase Receipt",

  // Selling
  "List/Sales Order/List": "Selling",
  "List/Sales Invoice/List": "Selling",
  "List/Price List/List": "Selling",
  "List/Pricing Rule/List": "Selling",
  "List/Customer/List": "Selling",
  "List/Customer Group/List": "Selling",
  "List/Address/List": "Selling",
  "List/Contact/List": "Selling",
  "List/UTM Source/List": "Selling",

  // Buying
  "List/Purchase Order/List": "Buying",
  "List/Purchase Invoice/List": "Buying",
  "List/Supplier/List": "Buying",
  "List/Supplier Group/List": "Buying",
};

// ── Prefix-match for Form/* routes (Form/<DocType>/<name>) ───────────────────
const ALAIY_ROUTE_PREFIX_TITLES = [
  { prefix: "Form/Stock Entry", title: "Stock" },
  { prefix: "Form/Item", title: "Stock" },
  { prefix: "Form/Stock Reconciliation", title: "Stock" },
  { prefix: "Form/Purchase Receipt", title: "Stock · Purchase Receipt" },
  { prefix: "Form/Sales Order", title: "Selling" },
  { prefix: "Form/Sales Invoice", title: "Selling" },
  { prefix: "Form/Customer", title: "Selling" },
  { prefix: "Form/Purchase Order", title: "Buying" },
  { prefix: "Form/Purchase Invoice", title: "Buying" },
  { prefix: "Form/Supplier", title: "Buying" },
];

// ── Title helpers ─────────────────────────────────────────────────────────────

/**
 * Set the browser tab title to:  "Alto Moda OS — <section> | Alaiy OS"
 * Pass `null` or `undefined` to reset to "Dashboard".
 */
function updateAlaiyTitle(section) {
  document.title =
    ALAIY_TITLE_PREFIX +
    " \u2014 " +
    (section || "Dashboard") +
    " | " +
    "Alaiy OS";
}

/**
 * Resolve a Frappe route string to an AlaiyOS section label.
 * Called by route_guard.js on every navigation.
 */
function resolveAlaiySection(route) {
  if (!route) return "Dashboard";

  // Exact match
  if (ALAIY_ROUTE_TITLES[route]) return ALAIY_ROUTE_TITLES[route];

  // Prefix match (Form/*)
  for (const entry of ALAIY_ROUTE_PREFIX_TITLES) {
    if (route.startsWith(entry.prefix)) return entry.title;
  }

  // Workspace root and settings panel (managed separately by alaiy_settings.js)
  if (route.startsWith("alaiy-os")) return "Dashboard";

  return "Alaiy OS";
}
