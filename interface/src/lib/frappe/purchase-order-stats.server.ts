// Server-only counterpart to purchase-order-stats.ts's client fetchers - see
// item-stats.server.ts for why this split exists.
import type { Period } from "@/types/list";
import type { PurchaseOrdersOverview } from "@/types/purchase-orders";

import { frappeFetch } from "./server";

export async function getPurchaseOrdersOverviewServer(period: Period): Promise<PurchaseOrdersOverview | null> {
  const res = await frappeFetch(
    `/api/method/alaiy_os.api.purchase_order_stats.get_purchase_orders_overview?period=${period}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: PurchaseOrdersOverview };
  return data.message ?? null;
}
