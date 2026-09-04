export type PurchaseOrderListRow = Record<string, unknown> & { name: string };

export type PurchaseOrderListParams = {
  fields: string[];
  filters?: Array<[string, string, unknown]>;
  orFilters?: Array<[string, string, unknown]>;
  orderBy?: string;
  limitStart?: number;
  limitPageLength?: number;
};

export async function fetchPurchaseOrders(params: PurchaseOrderListParams): Promise<PurchaseOrderListRow[]> {
  const query = new URLSearchParams();
  query.set("fields", JSON.stringify(params.fields));
  if (params.filters?.length) query.set("filters", JSON.stringify(params.filters));
  if (params.orFilters?.length) query.set("or_filters", JSON.stringify(params.orFilters));
  if (params.orderBy) query.set("order_by", params.orderBy);
  query.set("limit_start", String(params.limitStart ?? 0));
  query.set("limit_page_length", String(params.limitPageLength ?? 20));

  const res = await fetch(`/api/resource/Purchase Order?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch purchase orders: ${res.status}`);
  const data = (await res.json()) as { data: PurchaseOrderListRow[] };
  return data.data;
}

export async function fetchPurchaseOrderCount(
  filters?: Array<[string, string, unknown]>,
  orFilters?: Array<[string, string, unknown]>,
): Promise<number> {
  const query = new URLSearchParams();
  query.set("doctype", "Purchase Order");
  if (filters?.length) query.set("filters", JSON.stringify(filters));
  if (orFilters?.length) query.set("or_filters", JSON.stringify(orFilters));
  const res = await fetch(`/api/method/frappe.client.get_count?${query.toString()}`);
  if (!res.ok) return 0;
  const data = (await res.json()) as { message?: number };
  return data.message ?? 0;
}
