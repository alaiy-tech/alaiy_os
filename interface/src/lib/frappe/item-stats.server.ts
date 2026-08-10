// Server-only counterpart to item-stats.ts's client fetchers - same
// whitelisted method, called via frappeFetch (direct to Frappe, forwarding
// the request's cookies) instead of a relative browser fetch through our own
// /api/method proxy. Lets the Products KPI cards render as a Server
// Component with the data already resolved, no client-side fetch at all.
import type { Period } from "@/types/list";
import type { ProductsOverview } from "@/types/products";

import { frappeFetch } from "./server";

export async function getProductsOverviewServer(period: Period): Promise<ProductsOverview | null> {
  const res = await frappeFetch(`/api/method/alaiy_os.api.item_stats.get_products_overview?period=${period}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: ProductsOverview };
  return data.message ?? null;
}
