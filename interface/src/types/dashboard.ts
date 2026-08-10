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
