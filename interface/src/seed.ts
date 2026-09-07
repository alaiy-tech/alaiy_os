// Everything the local SQLite store seeds on first run: the UI pages
// (`SEED_PAGES`, checked against `PageConfigFile`/`UIPageDefinition` at
// compile time rather than hand-authored JSON) and the code-owned half of
// the `/os/*` sidebar (`buildCodeDefinedSidebar`).
import { contributedNav } from "@/config/contributed-nav";
import { iconName } from "@/config/nav-icons";
import type {
  NavContribution,
  SidebarNavGroupData,
  SidebarNavItemData,
} from "@/types/navigation";
import type { PageConfigFile } from "@/types/runtime/page";

/** The dashboard's one period-toggle's labels, single-sourced so the
 * `os-period-toggle` node's own `options` and `overview`'s `lookup`
 * transform step (which computes each KPI's `trendLabel` from the same
 * codes) can't quietly drift apart within this file - though the codes
 * themselves still have to independently match what the backend's own
 * `PERIOD_DAYS`/`_period_bounds` understands ( `dashboard_stats.py`), since
 * component `props` and a page's `data` are never cross-readable at
 * runtime. */
const DASHBOARD_PERIOD_LABELS: Record<string, string> = {
  "1D": "last day",
  "1W": "last week",
  "1M": "last month",
  "1Y": "last year",
};

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
 * `aov` and `salesOverTime` are the two required proofs that a computed KPI
 * and a chart's grouped data can come from raw doctype rows plus a
 * `transform` pipeline, not a bespoke source: `aov` sums/counts/divides
 * Sales Order rows itself (replacing the old pre-computed "Average Order"
 * KPI); `salesOverTime` groups Sales Order rows by the active period's own
 * day/month granularity (`group.granularity: "auto"` - replacing the old
 * `dashboard.salesTrend` method call, and its own always-by-month, never
 * period-scoped bug - the "profit" series is dropped, since profit isn't a
 * raw Sales Order field). Every KPI's
 * trend badge/caption is wired from `overview`'s own period-over-period
 * `{current, previous}` shape (`OsKpi`'s `previousValue` prop computes the
 * safe, divide-by-zero-aware percent change itself - see `kpi.tsx`) except
 * Average Order's `value`, which still deliberately comes from `aov` (the
 * transform-pipeline proof) - its `previousValue` borrows `overview`'s own
 * `average_order.previous` instead, since `aov` has no notion of a prior
 * period to compare against.
 *
 * `orders` is the third required proof: a real generic list with
 * request-driven search/filter/sort/pagination, all namespaced by this
 * entry's own name (`orders_page`/`orders_sort`/`orders_search`/
 * `orders_filter_<field>`) - no `frappe-list` abstraction, and (unlike the
 * disclosed console-warning bug this replaces) real `pageParam`/`sortParam`
 * bindings this time. Filtering is dynamic-field, not a fixed `status`
 * column - `query.filters: true` (paired with `exposeFields: true`) lets the
 * filter popover filter by *any* Sales Order field, not just one
 * author-declared one - see `runtime/data/resolver.ts`'s `readNamedFilters`.
 */
export const HEADLESS_DASHBOARD_PAGE: PageConfigFile = {
  id: "dashboard",
  route: "/os",
  metadata: {
    title: "Dashboard",
    description:
      "Your sales, orders, and stock at a glance - the Alaiy OS dashboard.",
    keywords: ["dashboard", "sales", "orders", "analytics", "Alaiy OS"],
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
        // `get_dashboard_overview` echoes the active period code back as
        // `period` - `lookup` maps it to the same human phrase the period
        // toggle's own `options[].label` uses, so every KPI's `trendLabel`
        // (below) can bind `overview.periodLabel` directly.
        transform: [
          {
            type: "lookup",
            field: "period",
            cases: DASHBOARD_PERIOD_LABELS,
            default: "last period",
            as: "periodLabel",
          },
        ],
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
        request: {
          type: "frappe",
          operation: "method",
          method: "alaiy_os.api.item_stats.get_stock_mix",
        },
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
              {
                field: "transaction_date",
                operator: ">=",
                value: "$period_start",
              },
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
      salesOverTime: {
        request: {
          type: "frappe",
          operation: "list",
          doctype: "Sales Order",
          params: {
            fields: ["transaction_date", "grand_total"],
            filters: [
              { field: "docstatus", operator: "=", value: 1 },
              // Scopes the chart to the active period toggle, same
              // sentinel `aov` already uses - without this the chart
              // always summed *every* Sales Order ever placed, regardless
              // of which period was selected.
              {
                field: "transaction_date",
                operator: ">=",
                value: "$period_start",
              },
            ],
            pageSize: 1000,
          },
        },
        transform: [
          {
            type: "group",
            by: "transaction_date",
            // Bucket width follows the active period (day-level for
            // 1D/1W/1M, month-level for 1Y) instead of always being a
            // fixed month, regardless of how wide the selected window is -
            // see `resolver.ts`'s `PERIOD_TO_GRANULARITY`.
            granularity: "auto",
            aggregate: { type: "sum", field: "grand_total", as: "sales" },
          },
          { type: "sort", field: "key", direction: "asc" },
        ],
      },
      orders: {
        request: {
          type: "frappe",
          operation: "list",
          doctype: "Sales Order",
          params: {
            fields: [
              "name",
              "customer",
              "grand_total",
              "status",
              "transaction_date",
            ],
            orderBy: "transaction_date desc",
            pageSize: 10,
          },
        },
        query: {
          pagination: { pageSize: 10, withTotal: true },
          sort: {
            allowedFields: [
              "transaction_date",
              "grand_total",
              "name",
              "customer",
            ],
          },
          search: { fields: ["name", "customer"] },
          filters: true,
        },
        exposeFields: true,
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
                    id: "period-toggle",
                    kind: "component",
                    type: "os-period-toggle",
                    props: {
                      paramName: "period",
                      options: Object.entries(DASHBOARD_PERIOD_LABELS).map(
                        ([value, label]) => ({ value, label }),
                      ),
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
                gap: 0,
                columns: { base: 1, md: 2 },
                layout: { span: { xl: 5 } },
                children: [
                  {
                    id: "kpi-total-sales",
                    kind: "component",
                    type: "os-kpi",
                    props: {
                      title: "Total Sales",
                      icon: "DollarSign",
                      format: "currency",
                      className: "rounded-none rounded-tl-lg",
                    },
                    data: {
                      value: { ref: "overview", path: "total_sales.current" },
                      previousValue: {
                        ref: "overview",
                        path: "total_sales.previous",
                      },
                      trendLabel: { ref: "overview", path: "periodLabel" },
                    },
                  },
                  {
                    id: "kpi-total-orders",
                    kind: "component",
                    type: "os-kpi",
                    props: {
                      title: "Total Orders",
                      icon: "ShoppingBag",
                      format: "number",
                      className: "rounded-none rounded-tr-lg",
                    },
                    data: {
                      value: { ref: "overview", path: "total_orders.current" },
                      previousValue: {
                        ref: "overview",
                        path: "total_orders.previous",
                      },
                      trendLabel: { ref: "overview", path: "periodLabel" },
                    },
                  },
                  {
                    id: "kpi-customer-growth",
                    kind: "component",
                    type: "os-kpi",
                    props: {
                      title: "Customer Growth",
                      icon: "Users",
                      format: "number",
                      className: "rounded-none",
                    },
                    data: {
                      value: {
                        ref: "overview",
                        path: "customer_growth.current",
                      },
                      previousValue: {
                        ref: "overview",
                        path: "customer_growth.previous",
                      },
                      trendLabel: { ref: "overview", path: "periodLabel" },
                    },
                  },
                  {
                    id: "kpi-average-order",
                    kind: "component",
                    type: "os-kpi",
                    props: {
                      title: "Average Order",
                      icon: "ReceiptText",
                      format: "currency",
                      className: "rounded-none",
                    },
                    data: {
                      value: { ref: "aov", path: "aov" },
                      previousValue: {
                        ref: "overview",
                        path: "average_order.previous",
                      },
                      trendLabel: { ref: "overview", path: "periodLabel" },
                    },
                  },
                  {
                    id: "kpi-return-requests",
                    kind: "component",
                    type: "os-kpi",
                    props: {
                      title: "Return Requests",
                      icon: "RotateCcw",
                      format: "number",
                      trendPolarity: "negative",
                      className: "rounded-none rounded-bl-lg",
                    },
                    data: {
                      value: {
                        ref: "overview",
                        path: "return_requests.current",
                      },
                      previousValue: {
                        ref: "overview",
                        path: "return_requests.previous",
                      },
                      trendLabel: { ref: "overview", path: "periodLabel" },
                    },
                  },
                  {
                    id: "kpi-stock-accuracy",
                    kind: "component",
                    type: "os-kpi",
                    props: {
                      title: "Stock Accuracy",
                      icon: "Scale",
                      format: "percent",
                      className: "rounded-none rounded-br-lg",
                    },
                    data: {
                      value: {
                        ref: "overview",
                        path: "stock_accuracy.current",
                      },
                      previousValue: {
                        ref: "overview",
                        path: "stock_accuracy.previous",
                      },
                      trendLabel: { ref: "overview", path: "periodLabel" },
                    },
                  },
                ],
              },
              {
                id: "chart-kpi-stack",
                kind: "layout",
                type: "stack",
                layout: { span: { xl: 7 } },
                children: [
                  {
                    id: "sales-overview-chart",
                    kind: "component",
                    type: "os-chart",
                    layout: { span: { xl: 12 } },
                    props: {
                      title: "Sales Order Trends",
                      icon: "BarChart3",
                      x: "key",
                      className: "rounded-lg flex-1 h-full",
                      legend: false,
                      series: [
                        { field: "sales", label: "Sales", type: "area" },
                      ],
                      // Demonstrates the chart-wide colour map (`ChartColorMap`
                      // in chart.tsx) - a literal RGB value, not a semantic
                      // token, since a chart's own palette is allowed to be more
                      // expressive than the rest of the UI. Equivalent to
                      // setting `color` inline on the "revenue" series itself;
                      // this form is what's reusable across multiple charts
                      // that share the same field name.
                      colors: { sales: "rgb(00, 32, 54)" },
                      // Revenue reads as currency on the Y-axis and in the
                      // tooltip; the x-axis' own `key` values (day- or
                      // month-shaped, depending on the active period - see
                      // `salesOverTime`'s `granularity: "auto"`) format
                      // themselves without any extra config here, since
                      // `xAxisFormat` defaults to `"auto"`.
                      valueFormat: "currency",
                    },
                    data: { rows: { ref: "salesOverTime", path: "rows" } },
                  },
                  {
                    id: "products-stock-row",
                    kind: "layout",
                    type: "grid",
                    gap: 0,
                    columns: { base: 1, xl: 12 },
                    children: [
                      {
                        id: "stock-kpi-grid",
                        kind: "layout",
                        type: "grid",
                        columns: { base: 1, md: 3 },
                        layout: { span: { xl: 12 } },
                        gap: 0,
                        children: [
                          {
                            id: "kpi-in-stock",
                            kind: "component",
                            type: "os-kpi",
                            // `get_stock_mix` is a live snapshot, not a period-over-period
                            // metric (see its own doc comment - deliberately not scoped
                            // to the period toggle) - `trendLabel` is a literal static
                            // caption here, not a `data` binding, and no `previousValue`
                            // is set, so no numeric trend badge renders alongside it.
                            props: {
                              title: "In Stock",
                              icon: "PackageCheck",
                              format: "number",
                              className: "rounded-none rounded-l-lg",
                            },
                            data: {
                              value: { ref: "stockMix", path: "in_stock" },
                            },
                          },
                          {
                            id: "kpi-low-stock",
                            kind: "component",
                            type: "os-kpi",
                            props: {
                              title: "Low Stock",
                              icon: "PackageSearch",
                              format: "number",
                              className: "rounded-none",
                            },
                            data: {
                              value: { ref: "stockMix", path: "low_stock" },
                            },
                          },
                          {
                            id: "kpi-out-of-stock",
                            kind: "component",
                            type: "os-kpi",
                            props: {
                              title: "Out of Stock",
                              icon: "Package",
                              format: "number",
                              className: "rounded-none rounded-r-lg",
                            },
                            data: {
                              value: { ref: "stockMix", path: "out_of_stock" },
                            },
                          },
                        ],
                      },
                    ],
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
              subtitle: "Overview of your recent sales orders ",
              rowId: "name",
              searchable: true,
              searchPlaceholder: "Search Recent Orders...",
              searchFields: ["name", "customer"],
              searchParam: "orders_search",
              filterParam: "orders",
              columnVisibility: true,
              minVisibleColumns: 5,
              selectable: true,
              actions: [
                {
                  items: [
                    {
                      label: "View",
                      action: {
                        type: "navigate",
                        url: "/os/sales/orders/{name}",
                      },
                    },
                    { label: "Edit", action: { type: "edit" } },
                  ],
                },
                {
                  items: [
                    {
                      label: "Delete",
                      tone: "destructive",
                      action: { type: "delete" },
                    },
                  ],
                },
              ],
              selectionActions: [
                {
                  items: [{ label: "Edit", action: { type: "edit" } }],
                },
                {
                  items: [
                    {
                      label: "Delete",
                      tone: "destructive",
                      action: { type: "delete" },
                    },
                  ],
                },
              ],
              paginated: true,
              pageParam: "orders_page",
              pageSize: 10,
              pagination: { page: 1, pageSize: 10, hasMore: false },
              pageSizeParam: "orders_page_size",
              sortParam: "orders_sort",
              emptyMessage: "No orders found.",
              columns: [
                { field: "name", label: "Order", compulsory: true },
                { field: "customer", label: "Customer" },
                {
                  field: "status",
                  label: "Status",
                  format: "badge",
                  badgeCategory: "sales",
                },
                {
                  field: "transaction_date",
                  label: "Date",
                  format: "date",
                  sortable: true,
                },
                {
                  field: "grand_total",
                  label: "Total",
                  format: "currency",
                  sortable: true,
                  textStyle: ["medium"],
                },
              ],
            },
            data: {
              rows: { ref: "orders", path: "rows" },
              pagination: { ref: "orders", path: "pagination" },
              fields: { ref: "orders", path: "fields" },
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
    items: [
      {
        id: "ask-alaiy",
        title: "Ask Alaiy",
        url: "/os/ask-alaiy",
        icon: "sparkles",
      },
    ],
  },
];

function contributionToItemData(
  item: NavContribution["items"][number],
): SidebarNavItemData {
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

  const merged = baseSidebarGroups.map((group) => ({
    ...group,
    items: [...group.items],
  }));

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
      const existing = target.items.findIndex(
        (candidate) => candidate.id === item.id,
      );
      if (existing === -1) target.items.push(item);
      else target.items[existing] = item;
    }
  }

  return merged;
}
