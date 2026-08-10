import type { Period } from "@/types/list";
import type { SalesOrdersOverview } from "@/types/sales-orders";

async function getMessage<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
  const data = (await res.json()) as { message: T };
  return data.message;
}

export function getSalesOrdersOverview(period: Period) {
  return getMessage<SalesOrdersOverview>(
    `/api/method/alaiy_os.api.sales_order_stats.get_sales_orders_overview?period=${period}`,
  );
}

export function getOrderStatuses() {
  return getMessage<string[]>("/api/method/alaiy_os.api.sales_order_stats.get_order_statuses");
}
