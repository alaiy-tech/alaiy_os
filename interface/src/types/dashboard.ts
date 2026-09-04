import type { PeriodComparison } from "@/types/list";

/** Accuracy of the latest stock audit. `previous` is null when the site has
 * only ever submitted one audit (nothing to compare against), and the whole
 * field is null when there are no audits at all - see
 * alaiy_os.api.dashboard_stats._stock_accuracy. */
export type StockAccuracy = {
  current: number;
  previous: number | null;
  audit_date: string | null;
};

export type DashboardOverview = {
  period: string;
  /** null means "all channels" - either nothing was selected, or this site has
   * no `sales_channel` field to filter on. */
  channel: string | null;
  total_sales: PeriodComparison;
  total_orders: PeriodComparison;
  customer_growth: PeriodComparison;
  average_order: PeriodComparison;
  /** null when the signed-in user cannot read Sales Invoice. */
  return_requests: PeriodComparison | null;
  stock_accuracy: StockAccuracy | null;
};

/** `period` arrives pre-labelled as "Aug 25 01-05" (month, 2-digit year,
 * day-range) - the Sales Overview chart's tick and tooltip formatters parse
 * that shape. */
export type SalesTrendPoint = {
  period: string;
  revenue: number;
  profit: number;
};

export type SalesTrend = {
  channel: string | null;
  points: SalesTrendPoint[];
};

/** Catalog-wide stock split, counted per Item across all warehouses - these are
 * SKU counts, not units (see alaiy_os.api.item_stats.get_stock_mix for the
 * thresholds). Point-in-time, so no period or channel applies. */
export type StockMix = {
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
};

/** Derived from the order's linked Sales Invoices: Refunded when a credit note
 * exists, Paid when nothing is outstanding, otherwise Pending. */
export type RecentOrderPayment = "Paid" | "Pending" | "Refunded";

/** Returned when a return Delivery Note exists, otherwise driven by the order's
 * per_delivered. */
export type RecentOrderFulfillment = "Fulfilled" | "Returned" | "Unfulfilled";

export type RecentOrder = {
  name: string;
  /** Frappe datetime ("YYYY-MM-DD HH:MM:SS.ffffff"), not ISO-8601. */
  creation: string;
  customer_name: string;
  grand_total: number;
  /** The order's own currency, which can differ from the org default. */
  currency: string | null;
  /** Total quantity across the order's lines. */
  item_count: number;
  payment: RecentOrderPayment;
  fulfillment: RecentOrderFulfillment;
};

/** Not period-scoped by design - "recent" means latest activity, so only the
 * channel filter applies. */
export type RecentOrdersResult = {
  channel: string | null;
  orders: RecentOrder[];
};

/** One segment of the Top Products category bar. `is_other` marks the
 * remainder segment that absorbs every category outside the top few - it gets
 * a muted colour rather than one from the chart palette. */
export type TopProductCategory = {
  name: string;
  amount: number;
  share: number;
  is_other: boolean;
};

export type TopProductRow = {
  item_code: string;
  item_name: string;
  /** The item's top-level Item Group, rolled up through the group tree. */
  category: string;
  amount: number;
  share: number;
};

/** `share` values are percentages of `total_sales`, which is line-level sales
 * (summed Sales Order Item amounts) - slightly below the Total Sales KPI, which
 * uses order-level grand_total and so includes tax and shipping. */
export type TopProductsOverview = {
  period: string;
  channel: string | null;
  total_sales: number;
  /** Combined share of the listed products - the card's headline figure. */
  top_share: number;
  categories: TopProductCategory[];
  products: TopProductRow[];
};
