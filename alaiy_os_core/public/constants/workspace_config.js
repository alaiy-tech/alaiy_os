/**
 * AlaiyOS — Workspace Sidebar Configuration (single source of truth for JS)
 *
 * This file is the JS counterpart of constants/workspace.py:WORKSPACE_SIDEBAR_ITEMS.
 * Keep both in sync when adding/renaming sections or DocTypes.
 *
 * type: "action"  — top/bottom standalone (dummy or JS-handled; never opens overlay)
 * type: "section" — collapsible section header (not clickable as a link)
 * type: "link"    — clickable item that opens a DocType list in the overlay
 *
 * Loaded before alaiy_workspace.js; ALAIY_LABEL_TO_DOCTYPE and ALAIY_SKIP_LABELS
 * are derived automatically at the bottom of this file.
 */

/* eslint-disable no-unused-vars */
const ALAIY_SIDEBAR_CONFIG = [
  // ── Top standalone actions ──────────────────────────────────────────────────
  { label: "Ask Alaiy",  type: "action", icon: "sparkles" },
  { label: "Dashboard",  type: "action", icon: "layout-dashboard" },
  { label: "My Pinned",  type: "action", icon: "pin" },

  // ── Inventory ───────────────────────────────────────────────────────────────
  { label: "Inventory",           type: "section" },
  { label: "Stock Entry",         type: "link", doctype: "Stock Entry",          icon: "package-plus" },
  { label: "Stock Reconciliation",type: "link", doctype: "Stock Reconciliation", icon: "clipboard-check" },
  { label: "Purchase Receipt",    type: "link", doctype: "Purchase Receipt",     icon: "package-check" },

  // ── Catalog ─────────────────────────────────────────────────────────────────
  { label: "Catalog",             type: "section" },
  { label: "Products",            type: "link", doctype: "Item",                 icon: "package" },
  { label: "Item Group",          type: "link", doctype: "Item Group",           icon: "boxes" },
  { label: "Item Attribute",      type: "link", doctype: "Item Attribute",       icon: "list-filter" },
  { label: "Brand",               type: "link", doctype: "Brand",                icon: "badge" },

  // ── Sales ────────────────────────────────────────────────────────────────────
  { label: "Sales",               type: "section" },
  { label: "Sales Order",         type: "link", doctype: "Sales Order",          icon: "shopping-cart" },
  { label: "Sales Invoice",       type: "link", doctype: "Sales Invoice",        icon: "receipt" },

  // ── Customers ────────────────────────────────────────────────────────────────
  { label: "Customers",           type: "section" },
  { label: "Customers",           type: "link", doctype: "Customer",             icon: "users" },
  { label: "Customer Groups",     type: "link", doctype: "Customer Group",       icon: "user-round" },
  { label: "Address",             type: "link", doctype: "Address",              icon: "map-pinned" },
  { label: "Contact",             type: "link", doctype: "Contact",              icon: "contact" },
  { label: "UTM Source",          type: "link", doctype: "UTM Source",           icon: "mouse-pointer-click" },

  // ── Procurement ──────────────────────────────────────────────────────────────
  { label: "Procurement",         type: "section" },
  { label: "Purchase Order",      type: "link", doctype: "Purchase Order",       icon: "file-input" },
  { label: "Purchase Invoice",    type: "link", doctype: "Purchase Invoice",     icon: "file-text" },
  { label: "Supplier",            type: "link", doctype: "Supplier",             icon: "truck" },
  { label: "Supplier Group",      type: "link", doctype: "Supplier Group",       icon: "network" },

  // ── Pricing ──────────────────────────────────────────────────────────────────
  { label: "Pricing",             type: "section" },
  { label: "Item Price",          type: "link", doctype: "Item Price",           icon: "tag" },
  { label: "Price List",          type: "link", doctype: "Price List",           icon: "tags" },
  { label: "Pricing Rule",        type: "link", doctype: "Pricing Rule",         icon: "badge-percent" },

  // ── Bottom standalone actions ────────────────────────────────────────────────
  { label: "Contacts",            type: "link", doctype: "Contact",              icon: "book-user" },
  { label: "Reports & Analytics", type: "action",                                icon: "chart-column" },
  { label: "Settings",            type: "action",                                icon: "settings" },
];

// ── Derived lookups (auto-built — do not edit by hand) ───────────────────────

// label → DocType for every "link" entry
const ALAIY_LABEL_TO_DOCTYPE = {};
ALAIY_SIDEBAR_CONFIG.forEach(function (item) {
  if (item.type === "link" && item.doctype) {
    ALAIY_LABEL_TO_DOCTYPE[item.label] = item.doctype;
  }
});

// Labels that should NOT open the overlay (actions + section headers)
// Note: "Customers" is both a section header AND a link — it is NOT skipped
// because the section break element is never clicked as a link in the DOM.
const ALAIY_SKIP_LABELS = new Set(
  ALAIY_SIDEBAR_CONFIG
    .filter(function (item) { return item.type !== "link"; })
    .map(function (item) { return item.label; })
);
/* eslint-enable no-unused-vars */
