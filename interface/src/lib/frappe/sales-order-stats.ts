import type { SalesOrdersSummary } from "@/types/sales-orders";

export type SalesOrdersSummaryParams = {
  filters?: Array<[string, string, unknown]>;
  orFilters?: Array<[string, string, unknown]>;
  /** Sent alongside the filters they already appear in — the endpoint needs
   * the window's length to derive the preceding period for the trend badges. */
  fromDate?: string;
  toDate?: string;
};

export async function getSalesOrdersSummary(params: SalesOrdersSummaryParams): Promise<SalesOrdersSummary> {
  const query = new URLSearchParams();
  if (params.filters?.length) query.set("filters", JSON.stringify(params.filters));
  if (params.orFilters?.length) query.set("or_filters", JSON.stringify(params.orFilters));
  if (params.fromDate) query.set("from_date", params.fromDate);
  if (params.toDate) query.set("to_date", params.toDate);

  const url = `/api/method/alaiy_os.api.sales_order_stats.get_sales_orders_summary?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch the sales orders summary: ${res.status}`);

  const data = (await res.json()) as { message: SalesOrdersSummary };
  return data.message;
}
