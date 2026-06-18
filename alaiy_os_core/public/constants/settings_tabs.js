/**
 * AlaiyOS — Settings Panel Tab Definitions
 *
 * Single source of truth for the settings layout.
 * Loaded via app_include_js before alaiy_settings.js.
 * Add, remove, or reorder tabs here only.
 *
 * Tab types:
 *   single   — mounts a Single DocType form directly
 *   stacked  — renders a group of sub-items; each item can be:
 *                type:"list"   — records table with drill-down
 *                type:"single" — Single DocType form mounted directly
 */
// eslint-disable-next-line no-unused-vars
const ALAIY_SETTINGS_TABS = [
  // ── Single DocType forms ──────────────────────────────────────────────────
  {
    id: "stock",
    label: "Stock",
    icon: "package",
    type: "single",
    doctype: "Stock Settings",
  },
  {
    id: "selling",
    label: "Selling",
    icon: "briefcase",
    type: "single",
    doctype: "Selling Settings",
  },
  {
    id: "buying",
    label: "Buying",
    icon: "shopping-cart",
    type: "single",
    doctype: "Buying Settings",
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: "accounting",
    type: "single",
    doctype: "Accounts Settings",
  },
  {
    id: "system",
    label: "System",
    icon: "settings",
    type: "single",
    doctype: "System Settings",
  },

  // ── Stacked: multiple sub-items on one page ───────────────────────────────
  {
    id: "organisation",
    label: "Organisation",
    icon: "building",
    type: "stacked",
    items: [
      { label: "Company", doctype: "Company", type: "list" },
      { label: "Letter Head", doctype: "Letter Head", type: "list" },
      { label: "Email Account", doctype: "Email Account", type: "list" },
      {
        label: "Item Variant Settings",
        doctype: "Item Variant Settings",
        type: "single",
      },
      {
        label: "Currency Exchange",
        doctype: "Currency Exchange",
        type: "list",
      },
    ],
  },
  {
    id: "users",
    label: "Users",
    icon: "users",
    type: "stacked",
    items: [
      { label: "Users", doctype: "User", type: "list" },
      { label: "Roles", doctype: "Role", type: "list" },
    ],
  },
  {
    id: "audits",
    label: "Audits",
    icon: "list",
    type: "stacked",
    items: [
      { label: "Activity Log", doctype: "Activity Log", type: "list" },
      { label: "Permission Log", doctype: "Permission Log", type: "list" },
      { label: "Access Log", doctype: "Access Log", type: "list" },
    ],
  },
];
