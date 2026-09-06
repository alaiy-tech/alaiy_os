import type { LogRow, LogSource } from "@/types/logs";

/** The log doctypes the current user can read. Server-filtered — see
 * alaiy_os.api.logs.get_log_sources — so this never needs permission logic of
 * its own. An empty array is a real answer: a site with no connector installed
 * has no logs to show. */
export async function fetchLogSources(): Promise<LogSource[]> {
  const res = await fetch("/api/method/alaiy_os.api.logs.get_log_sources");
  if (!res.ok) throw new Error(`Failed to fetch log sources: ${res.status}`);
  const data = (await res.json()) as { message?: LogSource[] };
  return data.message ?? [];
}

export type LogListParams = {
  doctype: string;
  fields: string[];
  filters?: Array<[string, string, unknown]>;
  limitStart?: number;
  limitPageLength?: number;
};

/** Logs are read through the generic resource API rather than an endpoint of
 * their own: the page has no knowledge of any particular log's shape, and the
 * doctype's own permissions are what decide whether the read is allowed. */
export async function fetchLogRows(params: LogListParams): Promise<LogRow[]> {
  const query = new URLSearchParams();
  query.set("fields", JSON.stringify(params.fields));
  if (params.filters?.length) query.set("filters", JSON.stringify(params.filters));
  // Newest first, matching every log doctype's own sort_field/sort_order.
  query.set("order_by", "creation desc");
  query.set("limit_start", String(params.limitStart ?? 0));
  query.set("limit_page_length", String(params.limitPageLength ?? 20));

  const res = await fetch(`/api/resource/${encodeURIComponent(params.doctype)}?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch ${params.doctype}: ${res.status}`);
  const data = (await res.json()) as { data: LogRow[] };
  return data.data;
}

export async function fetchLogCount(doctype: string, filters?: Array<[string, string, unknown]>): Promise<number> {
  const query = new URLSearchParams();
  query.set("doctype", doctype);
  if (filters?.length) query.set("filters", JSON.stringify(filters));
  const res = await fetch(`/api/method/frappe.client.get_count?${query.toString()}`);
  if (!res.ok) return 0;
  const data = (await res.json()) as { message?: number };
  return data.message ?? 0;
}

/** One log document in full. The table shows the doctype's in_list_view fields;
 * the drawer needs everything, including the long text a cell cannot hold. */
export async function fetchLogDocument(doctype: string, name: string): Promise<LogRow | null> {
  const res = await fetch(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: LogRow };
  return data.data ?? null;
}
