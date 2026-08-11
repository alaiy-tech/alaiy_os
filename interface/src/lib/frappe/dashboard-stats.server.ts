// Server-only fetchers for the OS home dashboard - see item-stats.server.ts for
// why the server/client split exists. The dashboard renders as a Server
// Component, so there is no client-side counterpart to this file.
import type { DashboardOverview, SalesTrend, TopProductsOverview } from "@/types/dashboard";
import type { Period } from "@/types/list";

import { frappeFetch } from "./server";

/** Builds the query string, dropping the "all channels" default - the API
 * treats a missing `channel` as unfiltered, so there is no point sending it. */
function query(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const serialised = search.toString();
  return serialised ? `?${serialised}` : "";
}

export async function getDashboardOverviewServer(
  period: Period,
  channel?: string | null,
): Promise<DashboardOverview | null> {
  const res = await frappeFetch(
    `/api/method/alaiy_os.api.dashboard_stats.get_dashboard_overview${query({ period, channel })}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: DashboardOverview };
  return data.message ?? null;
}

export async function getSalesTrendServer(channel?: string | null): Promise<SalesTrend | null> {
  const res = await frappeFetch(`/api/method/alaiy_os.api.dashboard_stats.get_sales_trend${query({ channel })}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: SalesTrend };
  return data.message ?? null;
}

export async function getTopProductsServer(
  period: Period,
  channel?: string | null,
): Promise<TopProductsOverview | null> {
  const res = await frappeFetch(
    `/api/method/alaiy_os.api.dashboard_stats.get_top_products${query({ period, channel })}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: TopProductsOverview };
  return data.message ?? null;
}

/** Channels present on existing orders, for the dashboard's channel select.
 * Empty on a site whose Sales Orders carry no `sales_channel` field - the
 * select then hides itself rather than offering a filter that cannot work. */
export async function getSalesChannelsServer(): Promise<string[]> {
  const res = await frappeFetch("/api/method/alaiy_os.api.dashboard_stats.get_sales_channels");
  if (!res.ok) return [];
  const data = (await res.json()) as { message?: string[] };
  return data.message ?? [];
}
