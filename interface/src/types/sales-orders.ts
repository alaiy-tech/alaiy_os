export type SalesOrderRow = Record<string, unknown> & {
  name: string;
  customer?: string;
  customer_name?: string;
  status?: string;
  transaction_date?: string;
  delivery_date?: string;
  grand_total?: number;
};

/** `previous` is null when no date range is selected: there is no comparable
 * preceding window, so the KPI card drops its trend badge rather than
 * comparing against an invented baseline. */
export type SummaryComparison = { current: number; previous: number | null };

export type SalesOrdersSummary = {
  total_orders: SummaryComparison;
  total_gmv: SummaryComparison;
  average_order_value: SummaryComparison;
  past_due_deliveries: SummaryComparison;
};

export type DateRange = { from?: Date; to?: Date };
