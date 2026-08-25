// Server-only: called via frappeFetch (direct to Frappe, forwarding the
// request's cookies). Consumed today by `ui-runtime/data/sources/dashboard.ts`'s
// `dashboard.stockMix` data source - `getProductsOverviewServer` (the
// Products page's own KPI fetcher) moved to `obsolete/` alongside the rest
// of the removed `/os/products` page's code.
import type { StockMix } from "@/types/dashboard";

import { frappeFetch } from "./server";

/** Backs the dashboard's stock-mix KPIs. Stock is point-in-time and not
 * channel-scoped, so this takes neither of the dashboard's filters. */
export async function getStockMixServer(): Promise<StockMix | null> {
  const res = await frappeFetch("/api/method/alaiy_os.api.item_stats.get_stock_mix");
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: StockMix };
  return data.message ?? null;
}
