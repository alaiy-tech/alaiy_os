// Server-only: called via frappeFetch (direct to Frappe, forwarding the
// request's cookies). Consumed by `runtime/data/sources/dashboard.ts`'s
// `dashboard.stockMix` data source and `runtime/data/sources/products.ts`'s
// `products.overview`.

import type { StockMix } from "@/types/dashboard";
import type { Period } from "@/types/list";
import type { ProductsOverview } from "@/types/products";

import { frappeFetch } from "./server";

/** Backs the dashboard's stock-mix KPIs. Stock is point-in-time and not
 * channel-scoped, so this takes neither of the dashboard's filters. */
export async function getStockMixServer(): Promise<StockMix | null> {
  const res = await frappeFetch("/api/method/alaiy_os.api.item_stats.get_stock_mix");
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: StockMix };
  return data.message ?? null;
}

/** Backs the Products page's four KPIs. The server-side counterpart of the
 * removed page's own `getProductsOverview`
 * (`obsolete/data/lib/frappe/item-stats.ts`), which fetched from the browser
 * - same endpoint, same shape. */
export async function getProductsOverviewServer(period: Period): Promise<ProductsOverview | null> {
  const res = await frappeFetch(
    `/api/method/alaiy_os.api.item_stats.get_products_overview?period=${encodeURIComponent(period)}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: ProductsOverview };
  return data.message ?? null;
}
