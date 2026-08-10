// Server-only counterpart to sales-order-stats.ts's client fetchers - see
// item-stats.server.ts for why this split exists.
import type { Period } from "@/types/list";
import type { SalesOrdersOverview } from "@/types/sales-orders";

import { frappeFetch } from "./server";

export async function getSalesOrdersOverviewServer(period: Period): Promise<SalesOrdersOverview | null> {
  const res = await frappeFetch(
    `/api/method/alaiy_os.api.sales_order_stats.get_sales_orders_overview?period=${period}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { message?: SalesOrdersOverview };
  return data.message ?? null;
}
