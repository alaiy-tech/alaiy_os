import { contributedNav } from "@/config/contributed-nav";
import { iconName } from "@/config/nav-icons";
import type { NavContribution, SidebarNavGroupData, SidebarNavItemData } from "@/types/navigation";

/**
 * The code-owned half of the `/os/*` sidebar: the base app's own groups,
 * merged with whatever the deployment composer generated into
 * `contributed-nav.ts` (see that file's doc comment - untouched, still an
 * empty array in this base repo). This module replaces the old
 * `sidebar-config.ts`'s role of exporting a ready-to-render `sidebarItems`
 * array; instead, `runtime/store/sqlite-sidebar-store.ts` calls
 * `buildCodeDefinedSidebar()` on every store construction and writes the
 * result into the `sidebar_groups`/`sidebar_items` tables as `source: 'code'`
 * rows - a redeploy that changes `contributed-nav.ts` (a new connector
 * installed) takes effect on the next app start with no manual reseed step,
 * the same way this file's own edits would.
 *
 * Icons are lower-kebab-case name strings (see `nav-icons.ts`'s doc comment
 * for why), not `LucideIcon` components - the one exception is folding in
 * `contributedNav`, whose items still carry real components per the
 * composer's unchanged contract; `iconName()` converts those to strings at
 * merge time.
 *
 * The "Settings" group that used to live here has moved out entirely - see
 * `components/layout/sidebar/settings-sidebar.tsx` - reached via a
 * "Settings" entry in the account menu instead of a sidebar group.
 */
const baseSidebarGroups: SidebarNavGroupData[] = [
  {
    id: "os",
    label: "OS",
    items: [
      { id: "ask-alaiy", title: "Ask Alaiy", url: "/os/ask-alaiy", icon: "sparkles" },
      { id: "dashboard", title: "Dashboard", url: "/os/dashboard", icon: "layout-dashboard" },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    items: [
      {
        id: "products",
        title: "Products",
        url: null,
        icon: "shopping-bag",
        subItems: [
          { id: "items", title: "Items", icon: "package", url: "/os/products" },
          { id: "item-groups", title: "Item Groups", icon: "folder-tree", url: "/os/item-groups" },
          { id: "brands", title: "Brands", icon: "tag", url: "/os/brands" },
          { id: "attributes", title: "Item Attributes", icon: "fingerprint", url: "/os/item-attributes" },
        ],
      },
      {
        id: "pricing",
        title: "Pricing",
        url: null,
        icon: "banknote",
        subItems: [
          { id: "item-prices", title: "Item Prices", icon: "banknote", url: "/os/item-prices" },
          { id: "pricing-rules", title: "Pricing Rules", icon: "scale", url: "/os/pricing-rules" },
        ],
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      {
        id: "orders",
        title: "Orders",
        url: null,
        icon: "receipt-text",
        subItems: [
          { id: "sales-orders", title: "Sales Orders", icon: "scroll-text", url: "/os/sales/orders" },
          { id: "sales-invoices", title: "Sales Invoices", icon: "receipt-text", url: "/os/sales-invoices" },
        ],
      },
      {
        id: "customers",
        title: "Customers",
        url: null,
        icon: "users",
        subItems: [
          { id: "customers-list", title: "Customers", icon: "users", url: "/os/customers" },
          { id: "customer-groups", title: "Customer Groups", icon: "boxes", url: "/os/customer-groups" },
        ],
      },
    ],
  },
  {
    id: "procurement",
    label: "Procurement",
    items: [
      {
        id: "purchasing",
        title: "Purchasing",
        url: null,
        icon: "shopping-bag",
        subItems: [
          {
            id: "purchase-orders",
            title: "Purchase Orders",
            icon: "shopping-bag",
            url: "/os/procurement/purchase-orders",
          },
          { id: "purchase-receipts", title: "Purchase Receipts", icon: "truck", url: "/os/purchase-receipts" },
          { id: "purchase-invoices", title: "Purchase Invoices", icon: "banknote", url: "/os/purchase-invoices" },
        ],
      },
      {
        id: "suppliers",
        title: "Suppliers",
        url: null,
        icon: "users",
        subItems: [
          { id: "suppliers-list", title: "Suppliers", icon: "store", url: "/os/suppliers" },
          { id: "supplier-groups", title: "Supplier Groups", icon: "boxes", url: "/os/supplier-groups" },
        ],
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    items: [
      {
        id: "warehousing",
        title: "Warehousing",
        url: null,
        icon: "forklift",
        subItems: [
          { id: "warehouses", title: "Warehouses", icon: "warehouse", url: "/os/warehouses" },
          { id: "stock-entries", title: "Stock Entries", icon: "forklift", url: "/os/stock-entries" },
          { id: "stock-ledger", title: "Stock Ledger", icon: "scroll-text", url: "/os/stock-ledger" },
          {
            id: "stock-reconciliation",
            title: "Stock Reconciliation",
            icon: "package-search",
            url: "/os/stock-reconciliation",
          },
        ],
      },
    ],
  },
];

function contributionToItemData(item: NavContribution["items"][number]): SidebarNavItemData {
  // `"url" in item`, not `if (item.subItems)`: NavMainItem is a union of a
  // link and a parent, and a parent's `subItems` is a required array — an
  // empty one is still truthy, so a falsy check cannot rule the parent out.
  // Testing for `url` (present only on the link variant) narrows the union
  // properly in both directions — the same idiom `search-menu.tsx` already
  // used for this exact union before this file existed.
  if ("url" in item) {
    return {
      id: item.id,
      title: item.title,
      url: item.url,
      icon: iconName(item.icon),
      badge: item.badge,
      disabled: item.disabled,
      newTab: item.newTab,
    };
  }
  return {
    id: item.id,
    title: item.title,
    url: null,
    icon: iconName(item.icon),
    badge: item.badge,
    disabled: item.disabled,
    newTab: item.newTab,
    subItems: item.subItems.map((sub) => ({
      id: sub.id,
      title: sub.title,
      url: sub.url,
      icon: iconName(sub.icon),
      badge: sub.badge,
      disabled: sub.disabled,
      newTab: sub.newTab,
    })),
  };
}

/**
 * Folds `contributedNav` into the base groups - the exact same semantics
 * `sidebar-config.ts`'s old `withContributions()` implemented (matched by
 * group `label`, an unrecognised label opens a new group, a contributed
 * item whose `id` already exists in the target group replaces it), just
 * producing plain-data groups instead of a render-ready array.
 */
export function buildCodeDefinedSidebar(): SidebarNavGroupData[] {
  if (contributedNav.length === 0) return baseSidebarGroups;

  const merged = baseSidebarGroups.map((group) => ({ ...group, items: [...group.items] }));

  for (const contribution of contributedNav) {
    let target = merged.find((group) => group.label === contribution.group);
    if (!target) {
      target = {
        id: `contributed-${contribution.group.toLowerCase().replace(/\s+/g, "-")}`,
        label: contribution.group,
        items: [],
      };
      merged.push(target);
    }
    for (const rawItem of contribution.items) {
      const item = contributionToItemData(rawItem);
      const existing = target.items.findIndex((candidate) => candidate.id === item.id);
      if (existing === -1) target.items.push(item);
      else target.items[existing] = item;
    }
  }

  return merged;
}
