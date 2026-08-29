// Everything the local SQLite store seeds on first run: the UI pages
// (`SEED_PAGES`, checked against `PageConfigFile`/`UIPageDefinition` at
// compile time rather than hand-authored JSON) and the code-owned half of
// the `/os/*` sidebar (`buildCodeDefinedSidebar`).
import { contributedNav } from "@/config/contributed-nav";
import { iconName } from "@/config/nav-icons";
import type { NavContribution, SidebarNavGroupData, SidebarNavItemData } from "@/types/navigation";
import type { PageConfigFile } from "@/types/runtime/page";

/**
 * The rebuilt `/os` dashboard, on the generic request+transform data model
 * (see docs/UI_RUNTIME.md) - same visual content as before (KPI row, sales
 * chart, top products, stock KPIs, recent orders table), no
 * `frappe-list`/`frappe-count` special-case source types anywhere.
 *
 * `overview`/`topProducts`/`stockMix` call the same real, already-correct
 * whitelisted Frappe methods the old bespoke `dashboard.ts` source used
 * (`alaiy_os.api.dashboard_stats.*`, `alaiy_os.api.item_stats.get_stock_mix`) -
 * complex business logic stays a method call (Phase 11), reached generically
 * via `operation: "method"` instead of a bespoke `*.server.ts` wrapper.
 * `$period`/`$period_start` are the two sentinels the resolver substitutes
 * from the page's own period filter - see `runtime/data/resolver.ts`.
 *
 * `aov` and `salesByMonth` are the two required proofs that a computed KPI
 * and a chart's grouped data can come from raw doctype rows plus a
 * `transform` pipeline, not a bespoke source: `aov` sums/counts/divides
 * Sales Order rows itself (replacing the old pre-computed "Average Order"
 * KPI); `salesByMonth` groups Sales Order rows by month client-side
 * (replacing the old `dashboard.salesTrend` method call - the "profit"
 * series is dropped, since profit isn't a raw Sales Order field). Trend/
 * delta arrows are dropped for every KPI in this rebuild - a safe
 * `(current - previous) / previous` needs a conditional the formula grammar
 * deliberately doesn't support yet; showing current values without arrows
 * is the disclosed simplification.
 *
 * `recentOrders` is the third required proof: a real generic list with
 * request-driven search/filter/sort/pagination, all namespaced by this
 * entry's own name (`orders_page`/`orders_page_size`/`orders_sort`/
 * `orders_search`/`orders_filter_status`) - no `frappe-list` abstraction, and
 * (unlike the disclosed console-warning bug this replaces) real
 * `pageParam`/`sortParam` bindings this time. Search, the status filter, and
 * column visibility all live in the table's own toolbar (`searchParam`/a
 * `filterParam` column/`columnVisibility`) rather than a separate
 * `os-filter-bar` node - see docs/UI_RUNTIME.md's "Generic List Query
 * State".
 */
export const HEADLESS_DASHBOARD_PAGE: PageConfigFile = {
  id: "dashboard",
  route: "/os",
  metadata: {
    title: "Dashboard",
    description: "The /os dashboard, composed through the generic request+transform data model.",
  },
  definition: {
    id: "headless-dashboard",
    kind: "page",
    data: {
      overview: {
        request: {
          type: "frappe",
          operation: "method",
          method: "alaiy_os.api.dashboard_stats.get_dashboard_overview",
          args: { period: "$period", channel: null },
        },
      },
      topProducts: {
        request: {
          type: "frappe",
          operation: "method",
          method: "alaiy_os.api.dashboard_stats.get_top_products",
          args: { period: "$period", channel: null },
        },
      },
      stockMix: {
        request: { type: "frappe", operation: "method", method: "alaiy_os.api.item_stats.get_stock_mix" },
      },
      aov: {
        request: {
          type: "frappe",
          operation: "list",
          doctype: "Sales Order",
          params: {
            fields: ["grand_total"],
            filters: [
              { field: "docstatus", operator: "=", value: 1 },
              { field: "transaction_date", operator: ">=", value: "$period_start" },
            ],
            pageSize: 1000,
          },
        },
        transform: [
          { type: "sum", field: "grand_total", as: "revenue" },
          { type: "count", as: "orders" },
          { type: "formula", expression: "revenue / orders", as: "aov" },
        ],
      },
      salesByMonth: {
        request: {
          type: "frappe",
          operation: "list",
          doctype: "Sales Order",
          params: {
            fields: ["transaction_date", "grand_total"],
            filters: [{ field: "docstatus", operator: "=", value: 1 }],
            pageSize: 1000,
          },
        },
        transform: [
          {
            type: "group",
            by: "transaction_date",
            granularity: "month",
            aggregate: { type: "sum", field: "grand_total", as: "revenue" },
          },
          { type: "sort", field: "key", direction: "asc" },
          { type: "limit", count: 12 },
        ],
      },
      recentOrders: {
        request: {
          type: "frappe",
          operation: "list",
          doctype: "Sales Order",
          params: {
            fields: ["name", "customer", "grand_total", "status", "transaction_date"],
            orderBy: "transaction_date desc",
            pageSize: 10,
          },
        },
        query: {
          pagination: { pageSize: 10 },
          sort: { allowedFields: ["transaction_date", "grand_total", "name", "customer"] },
          search: { fields: ["name", "customer"] },
          filters: [{ field: "status", operator: "=" }],
        },
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
                    data: { value: { ref: "overview", path: "total_sales.current" } },
                  },
                  {
                    id: "kpi-total-orders",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Total Orders", icon: "ShoppingBag", format: "number" },
                    data: { value: { ref: "overview", path: "total_orders.current" } },
                  },
                  {
                    id: "kpi-customer-growth",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Customer Growth", icon: "Users", format: "number" },
                    data: { value: { ref: "overview", path: "customer_growth.current" } },
                  },
                  {
                    id: "kpi-average-order",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Average Order", icon: "ReceiptText", format: "currency" },
                    data: { value: { ref: "aov", path: "aov" } },
                  },
                  {
                    id: "kpi-return-requests",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Return Requests", icon: "RotateCcw", format: "number", trendPolarity: "negative" },
                    data: { value: { ref: "overview", path: "return_requests.current" } },
                  },
                  {
                    id: "kpi-stock-accuracy",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Stock Accuracy", icon: "PackageCheck", format: "percent" },
                    data: { value: { ref: "overview", path: "stock_accuracy.current" } },
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
                  subtitle: "Revenue by month, computed from Sales Order rows via the generic transform pipeline.",
                  x: "key",
                  legend: true,
                  series: [{ field: "revenue", label: "Revenue", type: "area" }],
                },
                data: { rows: { ref: "salesByMonth", path: "rows" } },
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
                    { field: "item_name", label: "Product" },
                    { field: "category", label: "Category" },
                    { field: "share", label: "Share", format: "number", align: "right" },
                    { field: "amount", label: "Sales", format: "currency", align: "right" },
                  ],
                },
                data: { rows: { ref: "topProducts", path: "products" } },
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
                    data: { value: { ref: "stockMix", path: "in_stock" } },
                  },
                  {
                    id: "kpi-low-stock",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Low Stock", icon: "Package", format: "number" },
                    data: { value: { ref: "stockMix", path: "low_stock" } },
                  },
                  {
                    id: "kpi-out-of-stock",
                    kind: "component",
                    type: "os-kpi",
                    props: { title: "Out of Stock", icon: "Package", format: "number" },
                    data: { value: { ref: "stockMix", path: "out_of_stock" } },
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
              subtitle: "View your recent orders",
              rowId: "name",
              pageParam: "orders_page",
              pageSizeParam: "orders_page_size",
              sortParam: "orders_sort",
              searchable: true,
              searchParam: "orders_search",
              searchPlaceholder: "Search orders...",
              columnVisibility: true,
              emptyMessage: "No orders found.",
              columns: [
                { field: "name", label: "Order" },
                { field: "customer", label: "Customer" },
                {
                  field: "status",
                  label: "Status",
                  format: "badge",
                  badgeCategory: "sales",
                  filterable: true,
                  filterParam: "orders_filter_status",
                  filterOptions: [
                    "Draft",
                    "To Deliver and Bill",
                    "To Bill",
                    "To Deliver",
                    "Completed",
                    "Cancelled",
                    "Closed",
                    "On Hold",
                  ],
                },
                { field: "transaction_date", label: "Date", format: "date", sortable: true },
                { field: "grand_total", label: "Total", format: "currency", align: "right", sortable: true },
              ],
            },
            data: {
              rows: { ref: "recentOrders", path: "rows" },
              pagination: { ref: "recentOrders", path: "pagination" },
            },
          },
        ],
      },
    ],
  },
};

export const SEED_PAGES: PageConfigFile[] = [HEADLESS_DASHBOARD_PAGE];

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
