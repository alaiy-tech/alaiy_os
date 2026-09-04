export type ItemRow = Record<string, unknown> & { name: string };

export type ItemListParams = {
  fields: string[];
  filters?: Array<[string, string, unknown]>;
  orFilters?: Array<[string, string, unknown]>;
  orderBy?: string;
  limitStart?: number;
  limitPageLength?: number;
};

export async function fetchItems(params: ItemListParams): Promise<ItemRow[]> {
  const query = new URLSearchParams();
  query.set("fields", JSON.stringify(params.fields));
  if (params.filters?.length) query.set("filters", JSON.stringify(params.filters));
  if (params.orFilters?.length) query.set("or_filters", JSON.stringify(params.orFilters));
  if (params.orderBy) query.set("order_by", params.orderBy);
  query.set("limit_start", String(params.limitStart ?? 0));
  query.set("limit_page_length", String(params.limitPageLength ?? 20));

  const res = await fetch(`/api/resource/Item?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch items: ${res.status}`);
  const data = (await res.json()) as { data: ItemRow[] };
  return data.data;
}

export async function fetchItemCount(
  filters?: Array<[string, string, unknown]>,
  orFilters?: Array<[string, string, unknown]>,
): Promise<number> {
  const query = new URLSearchParams();
  query.set("doctype", "Item");
  if (filters?.length) query.set("filters", JSON.stringify(filters));
  if (orFilters?.length) query.set("or_filters", JSON.stringify(orFilters));
  const res = await fetch(`/api/method/frappe.client.get_count?${query.toString()}`);
  if (!res.ok) return 0;
  const data = (await res.json()) as { message?: number };
  return data.message ?? 0;
}
