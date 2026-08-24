import { Inventory } from "@/app/(main)/os/_components/inventory";
import { SalesOverviewChart } from "@/app/(main)/os/_components/sales-overview-chart";
import { TopProducts } from "@/app/(main)/os/_components/top-products";
import {
  baseComponentRegistry,
  type ComponentRegistry,
  mergeRegistries,
} from "@/runtime";

import { FilterBarNode } from "./filter-bar-node";
import { RecentOrdersTable } from "./recent-orders-table";

/**
 * The dashboard's own registry: the shared base entries (`os-page-header`,
 * `os-card`, `os-kpi`, `os-period-toggle`) merged with the dashboard-specific
 * components that don't generalize across features -
 * `SalesOverviewChart`/`Inventory`/`TopProducts` are structurally specific to
 * this page's data, not generic chart/gauge/list primitives, and
 * `os-data-table` needs its own statically-imported columns (see
 * `component-registry.ts`'s comment on why that type isn't in the base
 * registry). `/os/headless` is the only page that imports this.
 */
export const dashboardComponentRegistry: ComponentRegistry = mergeRegistries(
  baseComponentRegistry,
  {
    "os-filter-bar": {
      type: "os-filter-bar",
      component: FilterBarNode,
      description:
        "Dashboard's period + channel filters, plus a settings icon button.",
    },
    "os-data-table": {
      type: "os-data-table",
      component: RecentOrdersTable,
      description:
        "Recent orders: searchable, filterable, sortable, with column visibility and selection.",
    },
    "os-chart": {
      type: "os-chart",
      component: SalesOverviewChart,
      description: "Revenue/profit trend chart over the last 12 months.",
    },
    "os-inventory-gauge": {
      type: "os-inventory-gauge",
      component: Inventory,
      description:
        "Half-donut gauge of in-stock/low-stock/out-of-stock SKU counts.",
    },
    "os-top-products": {
      type: "os-top-products",
      component: TopProducts,
      description:
        "Top-selling products for the period, grouped by category share.",
    },
  },
);
