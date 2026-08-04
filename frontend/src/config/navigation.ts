import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Sparkles,
  Package,
  Layers,
  DollarSign,
  ListChecks,
  Percent,
  ArrowRightLeft,
  ClipboardCheck,
  Warehouse as WarehouseIcon,
  Building2,
  ShoppingCart,
  FileText,
  Receipt,
  Truck,
  ShoppingBag,
  ClipboardList,
  Building,
  Award,
  Users,
  User,
  Route,
  Settings,
} from "lucide-react";

/**
 * Single source of truth for the sidebar - lifted directly from the `NAV` /
 * `SETTINGS_ITEM` constants in mydesign/Alaiy OS Dashboard.dc.html (the
 * approved design). Add a nav item here and it is immediately routable (see
 * App.tsx, which generates a route per item, falling back to the shared
 * Coming Soon screen for anything not in BUILT_SCREENS). See
 * docs/adding-a-screen.md.
 */
export type NavItem = {
  label: string;
  /** Path relative to the dashboard root, e.g. "products". Empty string = index/Dashboard. */
  path: string;
  icon: LucideIcon;
  /** Real Frappe doctype this screen reads from, if any. */
  doctype?: string;
  /** Planned-layout template (T1-T10) shown on the Coming Soon screen - omitted for built/custom screens. */
  template?: string;
  badge?: string;
};

export type NavSection = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

export const navigationConfig: NavSection[] = [
  {
    label: "OS",
    icon: LayoutDashboard,
    items: [
      { label: "Dashboard", path: "", icon: LayoutDashboard },
      { label: "Ask Alaiy", path: "ask-alaiy", icon: Sparkles, badge: "2" },
    ],
  },
  {
    label: "Catalog",
    icon: Package,
    items: [
      { label: "Products", path: "products", icon: Package, doctype: "Item" },
      { label: "Item Group", path: "item-groups", icon: Layers, doctype: "Item Group", template: "T8 — lightweight reference list" },
      { label: "Item Price", path: "item-prices", icon: DollarSign, doctype: "Item Price", template: "T8 — lightweight reference list" },
      { label: "Price List", path: "price-lists", icon: ListChecks, doctype: "Price List", template: "T8 — lightweight reference list" },
      { label: "Pricing Rule", path: "pricing-rules", icon: Percent, doctype: "Pricing Rule", template: "T7 — config form" },
    ],
  },
  {
    label: "Inventory",
    icon: WarehouseIcon,
    items: [
      { label: "Stock Entry", path: "stock-entries", icon: ArrowRightLeft, doctype: "Stock Entry", template: "T6 — ledger / movement feed" },
      {
        label: "Stock Reconciliation",
        path: "stock-reconciliations",
        icon: ClipboardCheck,
        doctype: "Stock Reconciliation",
        template: "T6 — ledger / movement feed",
      },
      { label: "Warehouse", path: "warehouses", icon: WarehouseIcon, doctype: "Warehouse", template: "T4 variant — profile per warehouse" },
      { label: "Warehouse Type", path: "warehouse-types", icon: Building2, doctype: "Warehouse Type", template: "T8 — lightweight reference list" },
    ],
  },
  {
    label: "Sales",
    icon: ShoppingCart,
    items: [
      { label: "Sales Order", path: "sales-orders", icon: FileText, doctype: "Sales Order" },
      { label: "Sales Invoice", path: "sales-invoices", icon: Receipt, doctype: "Sales Invoice", template: "T2 — transactional list + detail" },
      { label: "Delivery Note", path: "delivery-notes", icon: Truck, doctype: "Delivery Note", template: "T2 — transactional list + detail" },
    ],
  },
  {
    label: "Procurement",
    icon: ShoppingBag,
    items: [
      { label: "Purchase Order", path: "purchase-orders", icon: FileText, doctype: "Purchase Order", template: "T2 — transactional list + detail" },
      { label: "Purchase Invoice", path: "purchase-invoices", icon: Receipt, doctype: "Purchase Invoice", template: "T2 — transactional list + detail" },
      { label: "Purchase Receipt", path: "purchase-receipts", icon: ClipboardList, doctype: "Purchase Receipt", template: "T2 variant — goods received" },
      { label: "Supplier", path: "suppliers", icon: Building, doctype: "Supplier", template: "T4 — directory / profile" },
      { label: "Supplier Group", path: "supplier-groups", icon: Building2, doctype: "Supplier Group", template: "T8 — lightweight reference list" },
      { label: "Supplier Scorecard", path: "supplier-scorecards", icon: Award, doctype: "Supplier Scorecard", template: "T5 — stage tracker" },
    ],
  },
  {
    label: "Customers",
    icon: Users,
    items: [
      { label: "Customer", path: "customers", icon: User, doctype: "Customer" },
      { label: "Customer Group", path: "customer-groups", icon: Users, doctype: "Customer Group", template: "T8 — lightweight reference list" },
    ],
  },
  {
    label: "Shipping",
    icon: Truck,
    items: [
      { label: "Delivery Note", path: "delivery-notes", icon: Truck, doctype: "Delivery Note", template: "T2 — transactional list + detail" },
      { label: "Shipping Rule", path: "shipping-rules", icon: Route, doctype: "Shipping Rule", template: "T7 — config form" },
    ],
  },
];

/**
 * Pinned at the bottom of the sidebar, outside any section (matches the
 * design's SETTINGS_ITEM). The design's mock data names the doctype
 * "Alaiy OS Settings", which doesn't exist in this app's doctype folder -
 * "OS Theme Settings" is the real singleton this screen would eventually
 * read/write, so that's what's wired here instead of copying the mock.
 */
export const settingsItem: NavItem = {
  label: "Settings",
  path: "settings",
  icon: Settings,
  doctype: "OS Theme Settings",
  template: "T7 — settings with tab strip",
};

/** Flattened, de-duplicated by path - used to generate routes and command-palette entries. */
export function flattenNavItems(): NavItem[] {
  const seen = new Set<string>();
  const result: NavItem[] = [];
  for (const section of navigationConfig) {
    for (const item of section.items) {
      if (seen.has(item.path)) continue;
      seen.add(item.path);
      result.push(item);
    }
  }
  return result;
}
