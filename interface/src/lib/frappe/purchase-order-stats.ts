import type { PurchaseOrdersSummary } from "@/types/purchase-orders";

export type PurchaseOrdersSummaryParams = {
  filters?: Array<[string, string, unknown]>;
  orFilters?: Array<[string, string, unknown]>;
  /** Sent alongside the filters they already appear in — the endpoint needs
   * the window's length to derive the preceding period for the trend badges. */
  fromDate?: string;
  toDate?: string;
};

export async function getPurchaseOrdersSummary(params: PurchaseOrdersSummaryParams): Promise<PurchaseOrdersSummary> {
  const query = new URLSearchParams();
  if (params.filters?.length) query.set("filters", JSON.stringify(params.filters));
  if (params.orFilters?.length) query.set("or_filters", JSON.stringify(params.orFilters));
  if (params.fromDate) query.set("from_date", params.fromDate);
  if (params.toDate) query.set("to_date", params.toDate);

  const url = `/api/method/alaiy_os.api.purchase_order_stats.get_purchase_orders_summary?${query.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch the purchase orders summary: ${res.status}`);

  const data = (await res.json()) as { message: PurchaseOrdersSummary };
  return data.message;
}
