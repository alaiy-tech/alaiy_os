/**
 * AlaiyOS — Route-to-Section Title Mappings
 *
 * Loaded via app_include_js before alaiy_ui.js and route_guard.js.
 *
 * ALAIY_ROUTE_TITLES        — exact frappe.get_route_str() → section label
 * ALAIY_ROUTE_PREFIX_TITLES — prefix matches for Form/<DocType>/... routes
 *
 * To add a new DocType to the title system:
 *   1. Add an entry to ALAIY_ROUTE_TITLES for its List view.
 *   2. Add an entry to ALAIY_ROUTE_PREFIX_TITLES for its Form view.
 */

// ── Exact-match route → section name ─────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
const ALAIY_ROUTE_TITLES = {
  // Workspace root
  "alaiy-os": "Dashboard",

  // ── Stock ────────────────────────────────────────────────────────────────
  "List/Stock Entry/List": "Stock",
  "List/Item/List": "Stock",
  "List/Item Group/List": "Stock",
  "List/Item Attribute/List": "Stock",
  "List/Item Price/List": "Stock",
  "List/Item Variant Attribute/List": "Stock",
  "List/Brand/List": "Stock",
  "List/Stock Reconciliation/List": "Stock",
  "List/Purchase Receipt/List": "Stock · Purchase Receipt",

  // ── Selling ──────────────────────────────────────────────────────────────
  "List/Sales Order/List": "Selling",
  "List/Sales Invoice/List": "Selling",
  "List/Price List/List": "Selling",
  "List/Pricing Rule/List": "Selling",
  "List/Customer/List": "Selling",
  "List/Customer Group/List": "Selling",
  "List/Address/List": "Selling",
  "List/Contact/List": "Selling",
  "List/UTM Source/List": "Selling",

  // ── Buying ───────────────────────────────────────────────────────────────
  "List/Purchase Order/List": "Buying",
  "List/Purchase Invoice/List": "Buying",
  "List/Supplier/List": "Buying",
  "List/Supplier Group/List": "Buying",
};

// ── Prefix-match for Form/<DocType>/<name> routes ────────────────────────────
// eslint-disable-next-line no-unused-vars
const ALAIY_ROUTE_PREFIX_TITLES = [
  { prefix: "Form/Stock Entry", title: "Stock Entry" },
  { prefix: "Form/Item", title: "Item" },
  { prefix: "Form/Stock Reconciliation", title: "Stock Reconciliation" },
  { prefix: "Form/Purchase Receipt", title: "Purchase Receipt" },
  { prefix: "Form/Sales Order", title: "Sales Order" },
  { prefix: "Form/Sales Invoice", title: "Sales Invoice" },
  { prefix: "Form/Customer", title: "Customer" },
  { prefix: "Form/Purchase Order", title: "Purchase Order" },
  { prefix: "Form/Purchase Invoice", title: "Purchase Invoice" },
  { prefix: "Form/Supplier", title: "Supplier" },
];
