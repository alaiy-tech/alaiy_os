import {
  Banknote,
  Boxes,
  Building2,
  Fingerprint,
  FolderTree,
  Forklift,
  LayoutDashboard,
  Package,
  PackageSearch,
  Palette,
  Plug,
  ReceiptText,
  Scale,
  ScrollText,
  Server,
  Shield,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

import { contributedNav } from "./contributed-nav";
import type { NavGroup, NavMainItem } from "./nav-types";

export type {
  NavBadge,
  NavGroup,
  NavMainItem,
  NavMainLinkItem,
  NavMainParentItem,
  NavSubItem,
} from "./nav-types";

const baseSidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "OS",
    items: [
      {
        id: "ask-alaiy",
        title: "Ask Alaiy",
        url: "/os/ask-alaiy",
        icon: Sparkles,
      },
      {
        id: "dashboard",
        title: "Dashboard",
        url: "/os",
        icon: LayoutDashboard,
      },
    ],
  },

  {
    id: 2,
    label: "Catalog",
    items: [
      {
        id: "products",
        title: "Products",
        icon: ShoppingBag,
        subItems: [
          {
            id: "items",
            title: "Items",
            icon: Package,
            url: "/os/products",
          },
          {
            id: "item-groups",
            title: "Item Groups",
            icon: FolderTree,
            url: "/os/item-groups",
          },
          {
            id: "brands",
            title: "Brands",
            icon: Tag,
            url: "/os/brands",
          },
          {
            id: "attributes",
            title: "Item Attributes",
            icon: Fingerprint,
            url: "/os/item-attributes",
          },
        ],
      },
      {
        id: "pricing",
        title: "Pricing",
        icon: Banknote,
        subItems: [
          {
            id: "item-prices",
            title: "Item Prices",
            icon: Banknote,
            url: "/os/item-prices",
          },
          {
            id: "pricing-rules",
            title: "Pricing Rules",
            icon: Scale,
            url: "/os/pricing-rules",
          },
        ],
      },
    ],
  },
  {
    id: 3,
    label: "Sales",
    items: [
      {
        id: "orders",
        title: "Orders",
        icon: ReceiptText,
        subItems: [
          {
            id: "sales-orders",
            title: "Sales Orders",
            icon: ScrollText,
            url: "/os/sales/orders",
          },
          {
            id: "sales-invoices",
            title: "Sales Invoices",
            icon: ReceiptText,
            url: "/os/sales-invoices",
          },
        ],
      },
      {
        id: "customers",
        title: "Customers",
        icon: Users,
        subItems: [
          {
            id: "customers-list",
            title: "Customers",
            icon: Users,
            url: "/os/customers",
          },
          {
            id: "customer-groups",
            title: "Customer Groups",
            icon: Boxes,
            url: "/os/customer-groups",
          },
        ],
      },
    ],
  },

  {
    id: 4,
    label: "Procurement",
    items: [
      {
        id: "purchasing",
        title: "Purchasing",
        icon: ShoppingBag,
        subItems: [
          {
            id: "purchase-orders",
            title: "Purchase Orders",
            icon: ShoppingBag,
            url: "/os/procurement/purchase-orders",
          },
          {
            id: "purchase-receipts",
            title: "Purchase Receipts",
            icon: Truck,
            url: "/os/purchase-receipts",
          },
          {
            id: "purchase-invoices",
            title: "Purchase Invoices",
            icon: Banknote,
            url: "/os/purchase-invoices",
          },
        ],
      },
      {
        id: "suppliers",
        title: "Suppliers",
        icon: Users,
        subItems: [
          {
            id: "suppliers-list",
            title: "Suppliers",
            icon: Store,
            url: "/os/suppliers",
          },
          {
            id: "supplier-groups",
            title: "Supplier Groups",
            icon: Boxes,
            url: "/os/supplier-groups",
          },
        ],
      },
    ],
  },

  {
    id: 5,
    label: "Inventory",
    items: [
      {
        id: "warehousing",
        title: "Warehousing",
        icon: Forklift,
        subItems: [
          {
            id: "warehouses",
            title: "Warehouses",
            icon: Warehouse,
            url: "/os/warehouses",
          },
          {
            id: "stock-entries",
            title: "Stock Entries",
            icon: Forklift,
            url: "/os/stock-entries",
          },
          {
            id: "stock-ledger",
            title: "Stock Ledger",
            icon: ScrollText,
            url: "/os/stock-ledger",
          },
          {
            id: "stock-reconciliation",
            title: "Stock Reconciliation",
            icon: PackageSearch,
            url: "/os/stock-reconciliation",
          },
        ],
      },
    ],
  },

  {
    id: 6,
    label: "Settings",
    items: [
      {
        id: "organisation",
        title: "Organisation",
        url: "/os/settings/organisation",
        icon: Building2,
      },
      {
        id: "users",
        title: "Users",
        url: "/os/settings/users",
        icon: Users,
      },
      {
        id: "roles",
        title: "Roles & Permissions",
        url: "/os/settings/roles",
        icon: Shield,
      },
      {
        id: "connectors",
        title: "Connectors",
        url: "/os/settings/connectors",
        icon: Plug,
      },
      // {
      //   id: "ai",
      //   title: "AI",
      //   icon: Sparkles,
      //   subItems: [
      //     {
      //       id: "agents",
      //       title: "Agents",
      //       url: "/os/settings/agents",
      //     },
      //   ],
      // },
      {
        id: "system",
        title: "System",
        icon: Server,
        subItems: [
          {
            id: "themes",
            title: "Themes",
            icon: Palette,
            url: "/os/settings/themes",
          },
          {
            id: "logs",
            title: "Logs",
            icon: Server,
            url: "/os/settings/logs",
          },
        ],
      },
    ],
  },
];

/**
 * Fold the contributing apps' nav entries into the base's groups.
 *
 * Matched by group `label`, so a connector asking for "Procurement" lands inside
 * the group the base already renders instead of opening a second one; an
 * unrecognised label appends a new group after the base's, which is what makes a
 * client able to add a whole section the base has never heard of.
 *
 * A contributed item whose `id` already exists in the target group replaces it,
 * rather than rendering twice — the composer is where an id collision is
 * reported, because a duplicate is a packaging mistake, not something worth
 * crashing a sidebar over.
 */
function withContributions(groups: NavGroup[]): NavGroup[] {
  if (contributedNav.length === 0) return groups;

  const merged = groups.map((group) => ({ ...group, items: [...group.items] }));
  let nextId = Math.max(0, ...merged.map((group) => group.id)) + 1;

  for (const contribution of contributedNav) {
    let target = merged.find((group) => group.label === contribution.group);
    if (!target) {
      target = { id: nextId++, label: contribution.group, items: [] };
      merged.push(target);
    }
    for (const item of contribution.items) {
      const existing = target.items.findIndex((candidate: NavMainItem) => candidate.id === item.id);
      if (existing === -1) target.items.push(item);
      else target.items[existing] = item;
    }
  }

  return merged;
}

export const sidebarItems: NavGroup[] = withContributions(baseSidebarItems);
