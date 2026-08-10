import {
  Banknote,
  ChartBar,
  CheckSquare,
  Fingerprint,
  FolderOpen,
  Forklift,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  Lock,
  type LucideIcon,
  ReceiptText,
  Server,
  ShoppingBag,
  Sparkles,
  Users,
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

export interface SidebarItem {
  id: string;
  title: string;
  icon?: LucideIcon;
  url?: string;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
  children?: SidebarItem[];
}

export interface SidebarGroup {
  id: string;
  label: string;
  children: SidebarItem[];
}

export const sidebarItems: SidebarGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    children: [
      {
        id: "dashboard-home",
        title: "Dashboard",
        url: "/os",
        icon: LayoutDashboard,
      },
    ],
  },

  {
    id: "catalog",
    label: "Catalog",
    children: [
      {
        id: "products",
        title: "Products",
        url: "/os/products",
        icon: ShoppingBag,
      },
      {
        id: "item-groups",
        title: "Item Groups",
        url: "/os/item-groups",
        icon: FolderOpen,
      },
      {
        id: "pricing",
        title: "Pricing",
        icon: Banknote,
        children: [
          {
            id: "item-prices",
            title: "Item Prices",
            url: "/os/item-prices",
            icon: Banknote,
          },
          {
            id: "pricing-rules",
            title: "Pricing Rules",
            url: "/os/pricing-rules",
            icon: CheckSquare,
          },
        ],
      },
    ],
  },

  {
    id: "inventory",
    label: "Inventory",
    children: [
      {
        id: "stock-entries",
        title: "Stock Entries",
        url: "/os/stock-entries",
        icon: ReceiptText,
      },
      {
        id: "warehouses",
        title: "Warehouses",
        url: "/os/warehouses",
        icon: Forklift,
      },
    ],
  },

  {
    id: "sales",
    label: "Sales",
    children: [
      {
        id: "sales-orders",
        title: "Sales Orders",
        url: "/os/sales-orders",
        icon: ReceiptText,
      },
      {
        id: "sales-invoices",
        title: "Sales Invoices",
        url: "/os/sales-invoices",
        icon: Banknote,
      },
      {
        id: "delivery-notes",
        title: "Delivery Notes",
        url: "/os/delivery-notes",
        icon: ShoppingBag,
      },
    ],
  },

  {
    id: "procurement",
    label: "Procurement",
    children: [
      {
        id: "purchases",
        title: "Purchases",
        icon: ShoppingBag,
        children: [
          {
            id: "purchase-orders",
            title: "Purchase Orders",
            url: "/os/purchase-orders",
            icon: ReceiptText,
          },
          {
            id: "purchase-invoices",
            title: "Purchase Invoices",
            url: "/os/purchase-invoices",
            icon: Banknote,
          },
          {
            id: "purchase-receipts",
            title: "Purchase Receipts",
            url: "/os/purchase-receipts",
            icon: ShoppingBag,
          },
        ],
      },
      {
        id: "suppliers",
        title: "Suppliers",
        url: "/os/suppliers",
        icon: Users,
      },
      {
        id: "supplier-groups",
        title: "Supplier Groups",
        url: "/os/supplier-groups",
        icon: FolderOpen,
      },
      {
        id: "supplier-scorecards",
        title: "Supplier Scorecards",
        url: "/os/supplier-scorecards",
        icon: GraduationCap,
      },
    ],
  },

  {
    id: "customers",
    label: "Customers",
    children: [
      {
        id: "customers-overview",
        title: "Overview",
        url: "/os/customers",
        icon: ChartBar,
      },
      {
        id: "customer-groups",
        title: "Customer Groups",
        url: "/os/customer-groups",
        icon: FolderOpen,
      },
    ],
  },

  {
    id: "settings",
    label: "Settings",
    children: [
      {
        id: "os-settings",
        title: "OS Settings",
        icon: Gauge,
        children: [
          {
            id: "agents",
            title: "Agents",
            url: "/os/settings/agents",
            icon: Users,
          },
          {
            id: "connectors",
            title: "Connectors",
            url: "/os/settings/connectors",
            icon: Server,
          },
          {
            id: "organisation",
            title: "Organisation",
            url: "/os/settings/organisation",
            icon: CheckSquare,
          },
          {
            id: "theme",
            title: "Theme",
            url: "/os/settings/themes",
            icon: Sparkles,
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
            icon: Lock,
          },
        ],
      },
    ],
  },
];
