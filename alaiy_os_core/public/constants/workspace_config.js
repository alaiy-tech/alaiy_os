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
  { label: "Ask Alaiy", type: "action", icon: "sparkles" },
  { label: "Dashboard", type: "action", icon: "layout-dashboard" },
  { label: "My Pinned", type: "action", icon: "pin" },
  { label: "Settings",  type: "action", icon: "settings" },

  // ── Catalog ─────────────────────────────────────────────────────────────────
  { label: "Catalog", type: "section", icon: "grid" },
  { label: "Products",       type: "link", doctype: "Item",            icon: "package" },
  { label: "Item Group",     type: "link", doctype: "Item Group",      icon: "boxes" },
  { label: "Item Attribute", type: "link", doctype: "Item Attribute",  icon: "list-filter" },
  { label: "Brand",          type: "link", doctype: "Brand",           icon: "badge" },
  { label: "Item Price",     type: "link", doctype: "Item Price",      icon: "tag" },
  { label: "Price List",     type: "link", doctype: "Price List",      icon: "tags" },
  { label: "Pricing Rule",   type: "link", doctype: "Pricing Rule",    icon: "badge-percent" },
  { label: "Manufacturer",   type: "link", doctype: "Manufacturer",    icon: "building-2" },
  { label: "Batch",          type: "link", doctype: "Batch",           icon: "layers" },
  { label: "Serial No",      type: "link", doctype: "Serial No",       icon: "hash" },

  // ── Inventory ───────────────────────────────────────────────────────────────
  { label: "Inventory", type: "section", icon: "archive" },
  { label: "Stock Entry",           type: "link", doctype: "Stock Entry",           icon: "package-plus" },
  { label: "Stock Reconciliation",  type: "link", doctype: "Stock Reconciliation",  icon: "clipboard-check" },
  { label: "Warehouse",             type: "link", doctype: "Warehouse",             icon: "warehouse" },
  { label: "Warehouse Type",        type: "link", doctype: "Warehouse Type",        icon: "factory" },
  { label: "Unit of Measure",       type: "link", doctype: "UOM",                   icon: "ruler" },
  { label: "UOM Category",          type: "link", doctype: "UOM Category",          icon: "folder-tree" },
  { label: "Stock Entry Type",      type: "link", doctype: "Stock Entry Type",      icon: "list-checks" },
  { label: "Putaway Rule",          type: "link", doctype: "Putaway Rule",          icon: "arrow-down-to-line" },

  // ── Quality ─────────────────────────────────────────────────────────────────
  { label: "Quality", type: "section", icon: "shield-check" },
  { label: "Inspection Templates", type: "link", doctype: "Quality Inspection Template",        icon: "file-check" },
  { label: "Parameters",           type: "link", doctype: "Quality Inspection Parameter",       icon: "list-checks" },
  { label: "Parameter Groups",     type: "link", doctype: "Quality Inspection Parameter Group", icon: "folder-open" },
  { label: "Item QC Parameters",   type: "link", doctype: "Item Quality Inspection Parameter",  icon: "package-check" },

  // ── Sales ────────────────────────────────────────────────────────────────────
  { label: "Sales", type: "section", icon: "trending-up" },
  { label: "Sales Order",         type: "link", doctype: "Sales Order",         icon: "shopping-cart" },
  { label: "Sales Invoice",       type: "link", doctype: "Sales Invoice",       icon: "receipt" },
  { label: "Delivery Note",       type: "link", doctype: "Delivery Note",       icon: "package-open" },
  { label: "Product Bundle",      type: "link", doctype: "Product Bundle",      icon: "package-2" },
  { label: "Sales Partner Type",  type: "link", doctype: "Sales Partner Type",  icon: "handshake" },
  { label: "Industry Type",       type: "link", doctype: "Industry Type",       icon: "building" },
  { label: "Party Specific Item", type: "link", doctype: "Party Specific Item", icon: "user-round-check" },
  { label: "Competitor",          type: "link", doctype: "Competitor",          icon: "swords" },
  { label: "Market Segment",      type: "link", doctype: "Market Segment",      icon: "chart-pie" },
  { label: "Sales Stage",         type: "link", doctype: "Sales Stage",         icon: "git-branch" },
  { label: "Sales Person",        type: "link", doctype: "Sales Person",        icon: "user-round" },
  { label: "Sales Partner",       type: "link", doctype: "Sales Partner",       icon: "users-round" },
  { label: "POS Profile",         type: "link", doctype: "POS Profile",         icon: "credit-card" },

  // ── Procurement ──────────────────────────────────────────────────────────────
  { label: "Procurement", type: "section", icon: "package-search" },
  { label: "Purchase Order",     type: "link", doctype: "Purchase Order",     icon: "file-input" },
  { label: "Purchase Invoice",   type: "link", doctype: "Purchase Invoice",   icon: "file-text" },
  { label: "Purchase Receipt",   type: "link", doctype: "Purchase Receipt",   icon: "package-check" },
  { label: "Supplier",           type: "link", doctype: "Supplier",           icon: "truck" },
  { label: "Supplier Group",     type: "link", doctype: "Supplier Group",     icon: "network" },
  { label: "Supplier Scorecard", type: "link", doctype: "Supplier Scorecard", icon: "star" },

  // ── Customers ────────────────────────────────────────────────────────────────
  // Link label is "Customer" (singular) — avoids collision with section header
  // "Customers" (plural) which is added to ALAIY_SKIP_LABELS.
  { label: "Customers", type: "section", icon: "users" },
  { label: "Customer",           type: "link", doctype: "Customer",           icon: "user" },
  { label: "Customer Group",     type: "link", doctype: "Customer Group",     icon: "users-round" },
  { label: "Address",            type: "link", doctype: "Address",            icon: "map-pinned" },
  { label: "UTM Source",         type: "link", doctype: "UTM Source",         icon: "mouse-pointer-click" },
  { label: "Contacts",           type: "link", doctype: "Contact",            icon: "book-user" },
  { label: "Coupon Code",        type: "link", doctype: "Coupon Code",        icon: "ticket" },
  { label: "Promotional Scheme", type: "link", doctype: "Promotional Scheme", icon: "gift" },
  { label: "Loyalty Program",    type: "link", doctype: "Loyalty Program",    icon: "badge-dollar-sign" },
  { label: "Subscription Plan",  type: "link", doctype: "Subscription Plan",  icon: "calendar-clock" },
  { label: "Campaign",           type: "link", doctype: "Campaign",           icon: "megaphone" },

  // ── Shipping ─────────────────────────────────────────────────────────────────
  { label: "Shipping", type: "section", icon: "truck" },
  { label: "Delivery Note", type: "link", doctype: "Delivery Note", icon: "package-open" },
  { label: "Shipping Rule", type: "link", doctype: "Shipping Rule", icon: "truck" },

  // ── Finance ──────────────────────────────────────────────────────────────────
  { label: "Finance", type: "section", icon: "landmark" },
  { label: "Payment Ledger",           type: "link", doctype: "Payment Ledger Entry",     icon: "book-open-text" },
  { label: "Payment Reconciliation",   type: "link", doctype: "Payment Reconciliation",   icon: "merge" },
  { label: "Payment Term",             type: "link", doctype: "Payment Term",             icon: "calendar-days" },
  { label: "Bank Reconciliation",      type: "link", doctype: "Bank Reconciliation Tool", icon: "banknote" },
  { label: "Tax Category",             type: "link", doctype: "Tax Category",             icon: "badge" },
  { label: "Tax Rule",                 type: "link", doctype: "Tax Rule",                 icon: "scale" },
  { label: "Tax Withholding Category", type: "link", doctype: "Tax Withholding Category", icon: "file" },
  { label: "Tax Withholding Group",    type: "link", doctype: "Tax Withholding Group",    icon: "folder" },

  // ── Accounts ─────────────────────────────────────────────────────────────────
  { label: "Accounts", type: "section", icon: "wallet" },
  { label: "Account",          type: "link", doctype: "Account",          icon: "landmark" },
  { label: "Cost Center",      type: "link", doctype: "Cost Center",      icon: "coins" },
  { label: "Finance Book",     type: "link", doctype: "Finance Book",     icon: "book" },
  { label: "Fiscal Year",      type: "link", doctype: "Fiscal Year",      icon: "calendar" },
  { label: "Currency Exchange", type: "link", doctype: "Currency Exchange", icon: "currency" },
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
const ALAIY_SKIP_LABELS = new Set(
  ALAIY_SIDEBAR_CONFIG.filter(function (item) {
    return item.type !== "link";
  }).map(function (item) {
    return item.label;
  }),
);
/* eslint-enable no-unused-vars */
