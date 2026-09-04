// Server-only counterpart to item-stats.ts's client fetchers - same
// whitelisted method, called via frappeFetch (direct to Frappe, forwarding
// the request's cookies) instead of a relative browser fetch through our own
// /api/method proxy. Lets the Products KPI cards render as a Server
// Component with the data already resolved, no client-side fetch at all.
import type { StockMix } from "@/types/dashboard";
import type { Period } from "@/types/list";
import type { ProductsOverview } from "@/types/products";

import { frappeFetch } from "./server";

export async function getProductsOverviewServer(period: Period): Promise<ProductsOverview | null> {
  const res = await frappeFetch(`/api/method/alaiy_os.api.item_stats.get_products_overview?period=${period}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: ProductsOverview };
  return data.message ?? null;
}

/** Backs the dashboard's Inventory gauge. Stock is point-in-time and not
 * channel-scoped, so this takes neither of the dashboard's filters. */
export async function getStockMixServer(): Promise<StockMix | null> {
  const res = await frappeFetch("/api/method/alaiy_os.api.item_stats.get_stock_mix");
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: StockMix };
  return data.message ?? null;
}
