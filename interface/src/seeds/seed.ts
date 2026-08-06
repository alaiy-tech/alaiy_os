// Everything the local SQLite store seeds on first run: the UI pages
// (`SEED_PAGES`, checked against `PageConfigFile`/`UIPageDefinition` at
// compile time rather than hand-authored JSON) and the code-owned half of
// the `/os/*` sidebar (`buildCodeDefinedSidebar`).
import { contributedNav } from "@/config/contributed-nav";
import { iconName } from "@/config/nav-icons";
import { STATUS_TONE } from "@/constants/list";
import type { NavContribution, SidebarNavGroupData, SidebarNavItemData } from "@/types/navigation";
import type { PageConfigFile } from "@/types/runtime/page";

export const HEADLESS_DASHBOARD_PAGE: PageConfigFile = {
  id: "dashboard",
  route: "/os",
  metadata: {
    title: "Dashboard",
    description: "The /os dashboard, composed through the UI runtime instead of hardcoded JSX.",
  },
  definition: {
    id: "headless-dashboard",
    kind: "page",
    children: [
      {
        id: "root-stack",
        kind: "layout",
        type: "stack",
        children: [
          {
            id: "page-header",
            kind: "component",
            type: "os-page-header",
            data: {
              title: { source: "dashboard.greeting", path: "greeting" },
              subtitle: { source: "dashboard.greeting", path: "formattedDate" },
            },
            children: [
              {
                id: "header-actions",
                kind: "layout",
                type: "inline",
                children: [
                  {
                    id: "filter-bar",
                    kind: "component",
                    type: "os-filter-bar",
                    props: {
                      filters: [
                        {
                          id: "period",
                          type: "select",
                          label: "Period",
                          searchParam: "period",
                          options: ["1D", "1W", "1M", "1Y"],
                          defaultValue: "1M",
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
          {
            id: "kpi-chart-row",
            kind: "layout",
            type: "grid",
            columns: { base: 1, xl: 12 },
            children: [
              {
                id: "kpi-grid",
                kind: "layout",
                type: "grid",
                columns: { base: 1, md: 2 },
                layout: { span: { xl: 5 } },
                children: [
                  {
                    id: "kpi-total-sales",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Total Sales", icon: "DollarSign", format: "currency" },
                    data: {
                      value: { source: "dashboard.overview", path: "total_sales" },
                      trend: { source: "dashboard.overview", path: "total_sales_delta" },
                      currency: { source: "dashboard.overview", path: "defaultCurrency" },
                    },
                  },
                  {
                    id: "kpi-total-orders",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Total Orders", icon: "ShoppingBag", format: "number" },
                    data: {
                      value: { source: "dashboard.overview", path: "total_orders" },
                      trend: { source: "dashboard.overview", path: "total_orders_delta" },
                    },
                  },
                  {
                    id: "kpi-customer-growth",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Customer Growth", icon: "Users", format: "number" },
                    data: {
                      value: { source: "dashboard.overview", path: "customer_growth" },
                      trend: { source: "dashboard.overview", path: "customer_growth_delta" },
                    },
                  },
                  {
                    id: "kpi-average-order",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Average Order", icon: "ReceiptText", format: "currency" },
                    data: {
                      value: { source: "dashboard.overview", path: "average_order" },
                      trend: { source: "dashboard.overview", path: "average_order_delta" },
                      currency: { source: "dashboard.overview", path: "defaultCurrency" },
                    },
                  },
                  {
                    id: "kpi-return-requests",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Return Requests", icon: "RotateCcw", format: "number", trendPolarity: "negative" },
                    data: {
                      value: { source: "dashboard.overview", path: "return_requests" },
                      trend: { source: "dashboard.overview", path: "return_requests_delta" },
                    },
                  },
                  {
                    id: "kpi-stock-accuracy",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Stock Accuracy", icon: "PackageCheck", format: "percent", trendUnit: "points" },
                    data: {
                      value: { source: "dashboard.overview", path: "stock_accuracy" },
                      trend: { source: "dashboard.overview", path: "stock_accuracy_delta" },
                    },
                  },
                ],
              },
              {
                id: "sales-overview-chart",
                kind: "component",
                type: "os-chart",
                layout: { span: { xl: 7 } },
                props: {
                  title: "Sales Overview",
                  x: "period",
                  legend: true,
                  series: [
                    { field: "revenue", label: "Revenue", type: "area" },
                    { field: "profit", label: "Profit", type: "bar" },
                  ],
                },
                data: { rows: { source: "dashboard.salesTrend" } },
              },
            ],
          },
          {
            id: "products-stock-row",
            kind: "layout",
            type: "grid",
            columns: { base: 1, xl: 12 },
            children: [
              {
                id: "top-products-table",
                kind: "component",
                type: "os-data-table",
                layout: { span: { xl: 6 } },
                props: {
                  title: "Top Products",
                  paginated: false,
                  emptyMessage: "No sales in this period.",
                  columns: [
                    { field: "item_name", label: "Product", sortable: true },
                    { field: "category", label: "Category" },
                    { field: "share", label: "Share", format: "number", align: "right" },
                    { field: "amount", label: "Sales", format: "currency", align: "right", sortable: true },
                  ],
                },
                data: { rows: { source: "dashboard.topProducts" } },
              },
              {
                id: "stock-kpi-grid",
                kind: "layout",
                type: "grid",
                columns: { base: 1, md: 3 },
                layout: { span: { xl: 6 } },
                children: [
                  {
                    id: "kpi-in-stock",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "In Stock", icon: "PackageCheck", format: "number" },
                    data: { value: { source: "dashboard.stockMix", path: "in_stock" } },
                  },
                  {
                    id: "kpi-low-stock",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Low Stock", icon: "Package", format: "number" },
                    data: { value: { source: "dashboard.stockMix", path: "low_stock" } },
                  },
                  {
                    id: "kpi-out-of-stock",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Out of Stock", icon: "Package", format: "number" },
                    data: { value: { source: "dashboard.stockMix", path: "out_of_stock" } },
                  },
                ],
              },
            ],
          },
          {
            id: "recent-orders-table",
            kind: "component",
            type: "os-data-table",
            props: {
              title: "Recent Orders",
              searchable: true,
              searchPlaceholder: "Search orders...",
              columnVisibility: true,
              compulsoryColumns: ["id", "customer"],
              minVisibleColumns: 3,
              selectable: true,
              paginated: true,
              pageSize: 10,
              emptyMessage: "No orders found.",
              columns: [
                { field: "id", label: "Order", sortable: true },
                { field: "customer", label: "Customer", filterable: true },
                {
                  field: "payment",
                  label: "Payment",
                  format: "badge",
                  filterable: true,
                  filterOptions: ["Paid", "Pending", "Refunded"],
                  badgeTones: { Paid: STATUS_TONE.success, Pending: STATUS_TONE.warning, Refunded: STATUS_TONE.destructive },
                },
                {
                  field: "fulfillment",
                  label: "Fulfillment",
                  format: "badge",
                  filterable: true,
                  filterOptions: ["Fulfilled", "Unfulfilled", "Returned"],
                  badgeTones: {
                    Fulfilled: STATUS_TONE.success,
                    Unfulfilled: STATUS_TONE.caution,
                    Returned: STATUS_TONE.destructive,
                  },
                },
                { field: "total", label: "Total", format: "currency", align: "right", sortable: true },
                { field: "date", label: "Date", format: "date", sortable: true },
              ],
            },
            data: {
              rows: { source: "dashboard.recentOrders" },
              currency: { source: "dashboard.overview", path: "defaultCurrency" },
            },
          },
        ],
      },
    ],
  },
};

export const HEADLESS_CUSTOMERS_PAGE: PageConfigFile = {
  id: "customers",
  route: "/os/customers",
  metadata: {
    title: "Customers",
    description: "The /os/customers page, composed through the UI runtime instead of hardcoded JSX.",
  },
  definition: {
    id: "headless-customers",
    kind: "page",
    children: [
      {
        id: "root-stack",
        kind: "layout",
        type: "stack",
        children: [
          {
            id: "page-header",
            kind: "component",
            type: "os-page-header",
            props: {
              title: "Customers",
              subtitle: "Track acquisition, ordering activity, and spend across your customer base.",
            },
            children: [
              {
                id: "header-actions",
                kind: "layout",
                type: "inline",
                children: [
                  {
                    id: "filter-bar",
                    kind: "component",
                    type: "os-filter-bar",
                    props: {
                      filters: [
                        {
                          id: "period",
                          type: "select",
                          label: "Period",
                          searchParam: "period",
                          options: ["1D", "1W", "1M", "1Y"],
                          defaultValue: "1M",
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
          {
            id: "kpi-grid",
            kind: "layout",
            type: "grid",
            columns: { base: 1, md: 2, xl: 4 },
            children: [
              {
                id: "kpi-total-customers",
                kind: "component",
                type: "os-kpi",
                props: { title: "Total Customers", icon: "UsersRound", format: "number" },
                data: {
                  value: { source: "customers.overview", path: "total_customers" },
                  trend: { source: "customers.overview", path: "total_customers_delta" },
                },
              },
              {
                id: "kpi-new-customers",
                kind: "component",
                type: "os-kpi",
                props: { title: "New Customers", icon: "TrendingUp", format: "number" },
                data: {
                  value: { source: "customers.overview", path: "new_customers" },
                  trend: { source: "customers.overview", path: "new_customers_delta" },
                },
              },
              {
                id: "kpi-active-customers",
                kind: "component",
                type: "os-kpi",
                props: { title: "Active Customers", icon: "Users", format: "number" },
                data: {
                  value: { source: "customers.overview", path: "active_customers" },
                  trend: { source: "customers.overview", path: "active_customers_delta" },
                },
              },
              {
                id: "kpi-revenue-per-customer",
                kind: "component",
                type: "os-kpi",
                props: { title: "Revenue per Customer", icon: "DollarSign", format: "currency" },
                data: {
                  value: { source: "customers.overview", path: "revenue_per_customer" },
                  trend: { source: "customers.overview", path: "revenue_per_customer_delta" },
                  currency: { source: "customers.overview", path: "defaultCurrency" },
                },
              },
            ],
          },
          {
            id: "customer-trend-chart",
            kind: "component",
            type: "os-chart",
            props: {
              title: "Acquisition",
              subtitle: "New customers against those who placed an order, by month over the last 12 months.",
              x: "period",
              legend: true,
              series: [
                { field: "new_customers", label: "New", type: "bar" },
                { field: "active_customers", label: "Ordered", type: "line" },
              ],
            },
            data: { rows: { source: "customers.trend" } },
          },
          {
            id: "customers-table",
            kind: "component",
            type: "os-data-table",
            props: {
              title: "Customers",
              searchable: true,
              searchPlaceholder: "Search customers...",
              columnVisibility: true,
              compulsoryColumns: ["name"],
              minVisibleColumns: 3,
              selectable: true,
              paginated: true,
              pageSize: 10,
              emptyMessage: "No customers found.",
              columns: [
                { field: "name", label: "Customer", sortable: true, filterable: true },
                {
                  field: "status",
                  label: "Status",
                  format: "badge",
                  filterable: true,
                  filterOptions: ["Active", "No Orders", "Disabled"],
                  badgeTones: {
                    Active: STATUS_TONE.success,
                    "No Orders": STATUS_TONE.neutral,
                    Disabled: STATUS_TONE.destructive,
                  },
                },
                { field: "group", label: "Group", filterable: true },
                { field: "territory", label: "Territory", filterable: true },
                { field: "orders", label: "Orders", format: "number", align: "right", sortable: true },
                { field: "spend", label: "Total Spend", format: "currency", align: "right", sortable: true },
                { field: "lastOrder", label: "Last Order", format: "date", sortable: true },
                { field: "joined", label: "Joined", format: "date", sortable: true },
              ],
            },
            data: {
              rows: { source: "customers" },
              currency: { source: "customers.overview", path: "defaultCurrency" },
            },
          },
        ],
      },
    ],
  },
};

/**
 * Proves the generic, declarative data path: `rows`/`pagination` bind to a
 * *named* `frappe-list` entry declared once in `definition.data`, no
 * per-page fetcher or source-registration file. Two independently-named,
 * independently-paginated tables (`customers`, `orders`) prove
 * `?customers_page=2`/`?orders_page=3` never collide - see
 * `docs/UI_RUNTIME.md`'s "Paginated Data Sources". Both request only
 * genuine native DocType fields via the standard REST endpoint, unlike
 * `HEADLESS_CUSTOMERS_PAGE` above, whose `customers` source also carries
 * `orders`/`total_spend` from a custom whitelisted API method the generic
 * source can't reach - the real boundary between generic Frappe access and
 * domain-specific computation.
 */
export const HEADLESS_DATA_TEST_PAGE: PageConfigFile = {
  id: "headless-data-test",
  route: "/os/headless-data-test",
  metadata: {
    title: "Data Runtime Test",
    description:
      "Proves the generic frappe-list/frappe-count data sources - two independently-paginated tables plus a count - against real Customer/Sales Order data, no page-specific fetcher.",
  },
  definition: {
    id: "headless-data-test-page",
    kind: "page",
    data: {
      customers: {
        type: "frappe-list",
        doctype: "Customer",
        fields: ["name", "customer_name", "customer_group", "territory"],
        filters: [{ field: "disabled", operator: "=", value: 0 }],
        orderBy: "modified desc",
        pagination: { pageSize: 10 },
      },
      orders: {
        type: "frappe-list",
        doctype: "Sales Order",
        fields: ["name", "customer", "transaction_date", "grand_total", "status"],
        orderBy: "transaction_date desc",
        pagination: { pageSize: 10 },
      },
    },
    children: [
      {
        id: "root-stack",
        kind: "layout",
        type: "stack",
        children: [
          {
            id: "page-header",
            kind: "component",
            type: "os-page-header",
            props: {
              title: "Data Runtime Test",
              subtitle:
                "Two independently-paginated generic list tables plus a count, all resolved through named frappe-list/frappe-count sources.",
            },
          },
          {
            id: "kpi-active-customers",
            kind: "component",
            type: "os-kpi",
            props: { title: "Active Customers", icon: "UsersRound", format: "number" },
            data: {
              value: {
                source: {
                  type: "frappe-count",
                  doctype: "Customer",
                  filters: [{ field: "disabled", operator: "=", value: 0 }],
                },
              },
            },
          },
          {
            id: "customers-table",
            kind: "component",
            type: "os-data-table",
            props: {
              title: "Customers",
              rowId: "name",
              pageParam: "customers_page",
              sortParam: "customers_sort",
              emptyMessage: "No customers found.",
              columns: [
                { field: "name", label: "ID", sortable: true },
                { field: "customer_name", label: "Customer", sortable: true },
                { field: "customer_group", label: "Group" },
                { field: "territory", label: "Territory" },
              ],
            },
            data: {
              rows: { ref: "customers", path: "data" },
              pagination: { ref: "customers", path: "pagination" },
              sort: { ref: "customers", path: "orderBy" },
            },
          },
          {
            id: "orders-table",
            kind: "component",
            type: "os-data-table",
            props: {
              title: "Orders",
              rowId: "name",
              pageParam: "orders_page",
              sortParam: "orders_sort",
              emptyMessage: "No orders found.",
              columns: [
                { field: "name", label: "Order", sortable: true },
                { field: "customer", label: "Customer" },
                { field: "transaction_date", label: "Date", format: "date" },
                { field: "grand_total", label: "Total", format: "currency", align: "right" },
                { field: "status", label: "Status" },
              ],
            },
            data: {
              rows: { ref: "orders", path: "data" },
              pagination: { ref: "orders", path: "pagination" },
              sort: { ref: "orders", path: "orderBy" },
            },
          },
        ],
      },
    ],
  },
};

/**
 * A production-style second `frappe-list` page: search, filter, sort, and
 * pagination all request-driven, all through one named source, no bespoke
 * fetcher. `Supplier` over `Product`: no live route uses either doctype,
 * but `obsolete/pages/os/products/` is heavy (variants, image carousel, a
 * detail route) - real scope-creep risk this doesn't need. Sorting is a
 * real `os-data-table` column-header interaction (`sortParam`/`sort`), not
 * a second "Sort by" control for `os-filter-bar` to own.
 */
export const HEADLESS_SUPPLIERS_PAGE: PageConfigFile = {
  id: "suppliers",
  route: "/os/suppliers",
  metadata: {
    title: "Suppliers",
    description:
      "A production-style frappe-list page: request-driven search, filter, sort, and pagination, no bespoke fetcher.",
  },
  definition: {
    id: "headless-suppliers-page",
    kind: "page",
    data: {
      suppliers: {
        type: "frappe-list",
        doctype: "Supplier",
        fields: ["name", "supplier_name", "supplier_group", "country"],
        search: { fields: ["supplier_name", "name"] },
        queryFilters: [{ field: "country", operator: "like" }],
        pagination: { pageSize: 10 },
      },
    },
    children: [
      {
        id: "root-stack",
        kind: "layout",
        type: "stack",
        children: [
          {
            id: "page-header",
            kind: "component",
            type: "os-page-header",
            props: {
              title: "Suppliers",
              subtitle:
                "Search, filter, sort, and page through suppliers - all resolved through a named frappe-list source.",
            },
            children: [
              {
                id: "header-actions",
                kind: "layout",
                type: "inline",
                children: [
                  {
                    id: "filter-bar",
                    kind: "component",
                    type: "os-filter-bar",
                    props: {
                      filters: [
                        {
                          id: "search",
                          type: "text",
                          label: "Search",
                          searchParam: "suppliers_search",
                          placeholder: "Search suppliers...",
                        },
                        {
                          id: "country",
                          type: "text",
                          label: "Country",
                          searchParam: "suppliers_filter_country",
                          placeholder: "Country",
                        },
                      ],
                      resetPageParams: ["suppliers_page"],
                    },
                  },
                ],
              },
            ],
          },
          {
            id: "suppliers-table",
            kind: "component",
            type: "os-data-table",
            props: {
              title: "Suppliers",
              rowId: "name",
              pageParam: "suppliers_page",
              sortParam: "suppliers_sort",
              emptyMessage: "No suppliers found.",
              columns: [
                { field: "name", label: "ID", sortable: true },
                { field: "supplier_name", label: "Supplier", sortable: true },
                { field: "supplier_group", label: "Group" },
                { field: "country", label: "Country" },
              ],
            },
            data: {
              rows: { ref: "suppliers", path: "data" },
              pagination: { ref: "suppliers", path: "pagination" },
              sort: { ref: "suppliers", path: "orderBy" },
            },
          },
        ],
      },
    ],
  },
};

export const SEED_PAGES: PageConfigFile[] = [
  HEADLESS_DASHBOARD_PAGE,
  HEADLESS_CUSTOMERS_PAGE,
  HEADLESS_DATA_TEST_PAGE,
  HEADLESS_SUPPLIERS_PAGE,
];

// The code-owned half of the `/os/*` sidebar: the base app's own groups,
// merged with whatever the deployment composer generated into
// `contributed-nav.ts` (empty in this base repo). `runtime/store/
// sqlite-sidebar-store.ts` calls `buildCodeDefinedSidebar()` on every store
// construction and writes the result as `source: 'code'` rows, so a
// redeploy that changes either takes effect on next start, no reseed step.
//
// Icons are lower-kebab-case name strings (see `nav-icons.ts`), not
// `LucideIcon` components - the exception is folding in `contributedNav`,
// whose items still carry real components; `iconName()` converts those at
// merge time.
//
// "Settings" isn't a sidebar-store group - it's a standalone button in
// `AppSidebar`'s own footer (baseline UI chrome, not sidebar-store data).
export const CONNECTORS_GROUP_LABEL = "Connectors";

const baseSidebarGroups: SidebarNavGroupData[] = [
  {
    id: "os",
    label: "OS",
    items: [{ id: "ask-alaiy", title: "Ask Alaiy", url: "/os/ask-alaiy", icon: "sparkles" }],
  },
];

function contributionToItemData(item: NavContribution["items"][number]): SidebarNavItemData {
  // `NavMainItem` is a union of a link and a parent; a parent's `subItems`
  // is a required array (an empty one is still truthy), so testing for
  // `url` (present only on the link variant) is what narrows correctly.
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
 * Folds `contributedNav` into the base groups, matched by group `label` (an
 * unrecognised label opens a new group; a contributed item whose `id`
 * already exists in the target group replaces it). A connector declares one
 * top-level item under `group: "Connectors"` - see
 * `docs/CONNECTOR_TO_BASE_UI_COMPOSITION.md` §16; an item there with no icon
 * falls back to `"plug"`, matching `connectors.tsx`'s own fallback.
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
    const isConnectorsGroup = target.label === CONNECTORS_GROUP_LABEL;
    for (const rawItem of contribution.items) {
      const item = contributionToItemData(rawItem);
      if (isConnectorsGroup && !item.icon) item.icon = "plug";
      const existing = target.items.findIndex((candidate) => candidate.id === item.id);
      if (existing === -1) target.items.push(item);
      else target.items[existing] = item;
    }
  }

  return merged;
}
