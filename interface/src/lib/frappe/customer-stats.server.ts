// Server-only fetchers for the Customers page, called via frappeFetch (direct
// to Frappe, forwarding the request's cookies) so the KPI strip and the
// acquisition chart both render as Server Components with their data already
// resolved - no client-side fetch, no loading state. Never import this from a
// "use client" module.

import type { CustomersOverview, CustomerTrendPoint } from "@/types/customers";
import type { Period } from "@/types/list";

import { frappeFetch } from "./server";

export async function getCustomersOverviewServer(period: Period): Promise<CustomersOverview | null> {
  const res = await frappeFetch(`/api/method/alaiy_os.api.customer_stats.get_customers_overview?period=${period}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: CustomersOverview };
  return data.message ?? null;
}

/** Backs the acquisition chart. Takes no period: the series is a rolling 12
 * months whatever the KPI strip above it is showing - see get_customer_trend
 * for why, and the dashboard's sales trend for the same call shape. */
export async function getCustomerTrendServer(): Promise<CustomerTrendPoint[]> {
  const res = await frappeFetch("/api/method/alaiy_os.api.customer_stats.get_customer_trend");
  if (!res.ok) return [];
  const data = (await res.json()) as { message?: { points?: CustomerTrendPoint[] } };
  return data.message?.points ?? [];
}
