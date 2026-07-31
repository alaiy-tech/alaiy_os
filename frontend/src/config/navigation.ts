import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Sparkles,
  Package,
  Layers,
  SlidersHorizontal,
  Tag,
  DollarSign,
  ListChecks,
  Percent,
  Hash,
  Warehouse as WarehouseIcon,
  ArrowRightLeft,
  ClipboardCheck,
  Building2,
  ShoppingCart,
  FileText,
  Receipt,
  Truck,
  PackageOpen,
  ShoppingBag,
  ClipboardList,
  Building,
  Award,
  Users,
  User,
  MapPin,
  Link2,
  Contact,
  Ticket,
  Megaphone,
  Gift,
  Repeat,
  Flag,
  Route,
  Landmark,
  Calendar,
  ArrowLeftRight,
  Settings,
} from "lucide-react";

/**
 * Single source of truth for the sidebar. Add a nav item here and it is
 * immediately routable (see App.tsx, which generates a route per item and
 * falls back to the shared "Coming soon" screen for anything not in
 * BUILT_SCREENS). See docs/adding-a-screen.md for the full walkthrough.
 */
export type NavItem = {
  label: string;
  /** Path relative to the dashboard root, e.g. "products". */
  path: string;
  icon: LucideIcon;
  /** Real Frappe doctype this screen reads from, if any (e.g. "Item"). */
  doctype?: string;
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
      { label: "Ask Alaiy", path: "ask-alaiy", icon: Sparkles },
    ],
  },
  {
    label: "Catalog",
    icon: Package,
    items: [
      { label: "Products", path: "products", icon: Package, doctype: "Item" },
      { label: "Item Group", path: "item-groups", icon: Layers, doctype: "Item Group" },
      { label: "Item Attribute", path: "item-attributes", icon: SlidersHorizontal, doctype: "Item Attribute" },
      { label: "Brand", path: "brands", icon: Tag, doctype: "Brand" },
      { label: "Item Price", path: "item-prices", icon: DollarSign, doctype: "Item Price" },
      { label: "Price List", path: "price-lists", icon: ListChecks, doctype: "Price List" },
      { label: "Pricing Rule", path: "pricing-rules", icon: Percent, doctype: "Pricing Rule" },
      { label: "Serial No", path: "serial-numbers", icon: Hash, doctype: "Serial No" },
    ],
  },
  {
    label: "Inventory",
    icon: WarehouseIcon,
    items: [
      { label: "Stock Entry", path: "stock-entries", icon: ArrowRightLeft, doctype: "Stock Entry" },
      { label: "Stock Reconciliation", path: "stock-reconciliations", icon: ClipboardCheck, doctype: "Stock Reconciliation" },
      { label: "Warehouse", path: "warehouses", icon: WarehouseIcon, doctype: "Warehouse" },
      { label: "Warehouse Type", path: "warehouse-types", icon: Building2, doctype: "Warehouse Type" },
    ],
  },
  {
    label: "Sales",
    icon: ShoppingCart,
    items: [
      { label: "Sales Order", path: "sales-orders", icon: FileText, doctype: "Sales Order" },
      { label: "Sales Invoice", path: "sales-invoices", icon: Receipt, doctype: "Sales Invoice" },
      { label: "Delivery Note", path: "delivery-notes", icon: Truck, doctype: "Delivery Note" },
      { label: "Product Bundle", path: "product-bundles", icon: PackageOpen, doctype: "Product Bundle" },
    ],
  },
  {
    label: "Procurement",
    icon: ShoppingBag,
    items: [
      { label: "Purchase Order", path: "purchase-orders", icon: FileText, doctype: "Purchase Order" },
      { label: "Purchase Invoice", path: "purchase-invoices", icon: Receipt, doctype: "Purchase Invoice" },
      { label: "Purchase Receipt", path: "purchase-receipts", icon: ClipboardList, doctype: "Purchase Receipt" },
      { label: "Supplier", path: "suppliers", icon: Building, doctype: "Supplier" },
      { label: "Supplier Group", path: "supplier-groups", icon: Building2, doctype: "Supplier Group" },
      { label: "Supplier Scorecard", path: "supplier-scorecards", icon: Award, doctype: "Supplier Scorecard" },
    ],
  },
  {
    label: "Customers",
    icon: Users,
    items: [
      { label: "Customer", path: "customers", icon: User, doctype: "Customer" },
      { label: "Customer Group", path: "customer-groups", icon: Users, doctype: "Customer Group" },
      { label: "Address", path: "addresses", icon: MapPin, doctype: "Address" },
      { label: "UTM Source", path: "utm-sources", icon: Link2, doctype: "UTM Source" },
      { label: "Contacts", path: "contacts", icon: Contact, doctype: "Contact" },
      { label: "Coupon Code", path: "coupon-codes", icon: Ticket, doctype: "Coupon Code" },
      { label: "Promotional Scheme", path: "promotional-schemes", icon: Megaphone, doctype: "Promotional Scheme" },
      { label: "Loyalty Program", path: "loyalty-programs", icon: Gift, doctype: "Loyalty Program" },
      { label: "Subscription Plan", path: "subscription-plans", icon: Repeat, doctype: "Subscription Plan" },
      { label: "Campaign", path: "campaigns", icon: Flag, doctype: "Campaign" },
    ],
  },
  {
    label: "Shipping",
    icon: Truck,
    items: [
      { label: "Delivery Note", path: "delivery-notes", icon: Truck, doctype: "Delivery Note" },
      { label: "Shipping Rule", path: "shipping-rules", icon: Route, doctype: "Shipping Rule" },
    ],
  },
  {
    label: "Accounts",
    icon: Landmark,
    items: [
      { label: "Fiscal Year", path: "fiscal-years", icon: Calendar, doctype: "Fiscal Year" },
      { label: "Currency Exchange", path: "currency-exchanges", icon: ArrowLeftRight, doctype: "Currency Exchange" },
      { label: "Settings", path: "accounts-settings", icon: Settings },
    ],
  },
];

/** Flattened, de-duplicated by path — used to generate routes and command-palette entries. */
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
