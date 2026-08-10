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
  type LucideIcon,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
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
            url: "/os/sales-orders",
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
            url: "/os/purchase-orders",
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
      //  {
      //   id: "ai",
      //   title: "Connectors",
      //   icon: Sparkles,
      //   subItems: [
      //     {
      //       id: "agents",
      //       title: "Agents",
      //       url: "/os/settings/agents",
      //     },
      //   ],
      // },
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
