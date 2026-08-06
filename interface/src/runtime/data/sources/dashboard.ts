import { format } from "date-fns";

import { readPeriod } from "@/components/derived/list/period";
import {
  getDashboardOverviewServer,
  getRecentOrdersServer,
  getSalesTrendServer,
  getTopProductsServer,
} from "@/lib/frappe/dashboard-stats.server";
import { getStockMixServer } from "@/lib/frappe/item-stats.server";
import { getCompanyInfo, getServerUser } from "@/lib/frappe/server";
import type { PeriodComparison } from "@/types/list";
import type { DataSourceContext } from "@/types/runtime/data-source";

import { registerDataSource } from "../../registry/data-source-registry";

/**
 * Dashboard data sources - each `resolve()` calls the *existing, unmodified*
 * fetchers in `src/lib/frappe/dashboard-stats.server.ts` /
 * `item-stats.server.ts`. The Data Source Registry is the abstraction
 * boundary; nothing about how these fetchers talk to Frappe changes here.
 *
 * Disclosed simplification: the dashboard's channel filter is dropped in
 * this round (its options are inherently dynamic per-site data, and the new
 * declarative `filter-bar` contract doesn't yet support a data-bound options
 * list - see `UI_RUNTIME.md`'s "known limitations"). Every source below
 * always resolves unfiltered-by-channel data; only `period` still applies.
 */

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function flattenComparison(
  metric: string,
  comparison: PeriodComparison | null | undefined,
  out: Record<string, unknown>,
) {
  if (!comparison) return;
  out[metric] = comparison.current;
  out[`${metric}_delta`] = pctChange(comparison.current, comparison.previous);
}

registerDataSource({
  id: "dashboard.overview",
  description:
    "Headline KPI figures for the dashboard: sales, orders, customer growth, average order, returns, stock accuracy.",
  capabilities: {},
  fields: [
    { name: "total_sales", label: "Total Sales", type: "currency" },
    { name: "total_orders", label: "Total Orders", type: "number" },
    { name: "customer_growth", label: "Customer Growth", type: "number" },
    { name: "average_order", label: "Average Order", type: "currency" },
    { name: "return_requests", label: "Return Requests", type: "number" },
    { name: "stock_accuracy", label: "Stock Accuracy", type: "number" },
  ],
  async resolve(context: DataSourceContext) {
    const period = readPeriod(context.searchParams);
    const [overview, company] = await Promise.all([
      getDashboardOverviewServer(period),
      getCompanyInfo(),
    ]);

    const flat: Record<string, unknown> = {
      period,
      defaultCurrency: company?.defaultCurrency ?? undefined,
    };
    if (overview) {
      flattenComparison("total_sales", overview.total_sales, flat);
      flattenComparison("total_orders", overview.total_orders, flat);
      flattenComparison("customer_growth", overview.customer_growth, flat);
      flattenComparison("average_order", overview.average_order, flat);
      flattenComparison("return_requests", overview.return_requests, flat);
      if (overview.stock_accuracy) {
        flat.stock_accuracy = overview.stock_accuracy.current;
        flat.stock_accuracy_delta =
          overview.stock_accuracy.previous === null
            ? undefined
            : Math.round(
                (overview.stock_accuracy.current -
                  overview.stock_accuracy.previous) *
                  10,
              ) / 10;
      }
    }
    return flat;
  },
});

registerDataSource({
  id: "dashboard.greeting",
  description: "A personalized page-header greeting and the current date.",
  capabilities: {},
  fields: [
    { name: "greeting", label: "Greeting", type: "string" },
    { name: "formattedDate", label: "Date", type: "string" },
  ],
  async resolve() {
    const user = await getServerUser();
    const firstName = user?.fullName.split(" ")[0] ?? "there";
    return {
      greeting: `Welcome, ${firstName}!`,
      formattedDate: format(new Date(), "EEEE, do MMMM yyyy"),
    };
  },
});

registerDataSource({
  id: "dashboard.salesTrend",
  description: "Monthly revenue and profit over the last 12 months.",
  capabilities: { list: true },
  fields: [
    { name: "period", label: "Period", type: "string" },
    { name: "revenue", label: "Revenue", type: "currency" },
    { name: "profit", label: "Profit", type: "currency" },
  ],
  async resolve() {
    const trend = await getSalesTrendServer();
    return trend?.points ?? [];
  },
});

registerDataSource({
  id: "dashboard.topProducts",
  description:
    "Top-selling products for the current period, by category share.",
  capabilities: { list: true },
  fields: [
    { name: "item_name", label: "Product", type: "string" },
    { name: "category", label: "Category", type: "string" },
    { name: "amount", label: "Sales", type: "currency" },
    { name: "share", label: "Share", type: "number" },
  ],
  async resolve(context: DataSourceContext) {
    const period = readPeriod(context.searchParams);
    const overview = await getTopProductsServer(period);
    return overview?.products ?? [];
  },
});

registerDataSource({
  id: "dashboard.stockMix",
  description:
    "Catalog-wide stock split: in-stock, low-stock, and out-of-stock SKU counts.",
  capabilities: {},
  fields: [
    { name: "in_stock", label: "In Stock", type: "number" },
    { name: "low_stock", label: "Low Stock", type: "number" },
    { name: "out_of_stock", label: "Out of Stock", type: "number" },
  ],
  async resolve() {
    const mix = await getStockMixServer();
    return mix ?? { in_stock: 0, low_stock: 0, out_of_stock: 0 };
  },
});

registerDataSource({
  id: "dashboard.recentOrders",
  description:
    "The most recent sales orders, with payment and fulfillment status.",
  capabilities: {
    list: true,
    search: true,
    filter: true,
    sort: true,
    pagination: true,
  },
  fields: [
    { name: "id", label: "Order", type: "string" },
    { name: "customer", label: "Customer", type: "string" },
    { name: "payment", label: "Payment", type: "string" },
    { name: "fulfillment", label: "Fulfillment", type: "string" },
    { name: "total", label: "Total", type: "currency" },
    { name: "date", label: "Date", type: "date" },
  ],
  async resolve() {
    const result = await getRecentOrdersServer();
    return (result?.orders ?? []).map((order) => ({
      id: order.name,
      customer: order.customer_name,
      payment: order.payment,
      fulfillment: order.fulfillment,
      total: order.grand_total,
      date: order.creation.replace(" ", "T"),
      items: Math.round(order.item_count),
    }));
  },
});
