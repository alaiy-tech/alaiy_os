import type { Period } from "@/components/list/period";
import type { DashboardOverview, RecentOrder, SalesTrendPoint, StockMix, TopProductsOverview } from "@/types/dashboard";

import { computeDashboardKpi, type DashboardKpiMetric, type ResolvedKpi } from "./kpi-source";
import { toRecentOrderRow } from "./recent-orders-columns";

/** The raw, already-fetched data `/os/headless/page.tsx` has after calling
 * the exact same server fetchers `/os/page.tsx` calls. */
export type DashboardRawData = {
  overview: DashboardOverview | null;
  salesTrendPoints: SalesTrendPoint[];
  topProducts: TopProductsOverview | null;
  stockMix: StockMix | null;
  recentOrders: RecentOrder[];
  channels: string[];
  period: Period;
  defaultCurrency?: string;
  greeting: string;
  formattedDate: string;
};

const DASHBOARD_KPI_METRICS: DashboardKpiMetric[] = [
  "total_sales",
  "total_orders",
  "customer_growth",
  "average_order",
  "return_requests",
  "stock_accuracy",
];

/**
 * Shapes `/os/headless`'s raw fetch results into the dashboard's own named
 * `DataSource`s (see `ui-runtime/data/resolve-data-source.ts`) - the "Data
 * Resolver" the UI Definition's `data` refs point at. This is the only place
 * in the dashboard feature that knows the *shape* of the fetched data; the
 * JSON config and the runtime only ever see the named sources below.
 */
export function buildDashboardDataSources(raw: DashboardRawData): Record<string, unknown> {
  const kpis: Record<DashboardKpiMetric, ResolvedKpi> = Object.fromEntries(
    DASHBOARD_KPI_METRICS.map((metric) => [
      metric,
      computeDashboardKpi(metric, raw.overview, raw.period, raw.defaultCurrency),
    ]),
  ) as Record<DashboardKpiMetric, ResolvedKpi>;

  return {
    overview: raw.overview,
    salesTrend: { points: raw.salesTrendPoints },
    topProducts: raw.topProducts,
    stockMix: raw.stockMix,
    recentOrders: raw.recentOrders.map((order) => toRecentOrderRow(order, raw.defaultCurrency)),
    channels: raw.channels,
    period: raw.period,
    defaultCurrency: raw.defaultCurrency,
    greeting: raw.greeting,
    formattedDate: raw.formattedDate,
    kpis,
  };
}
