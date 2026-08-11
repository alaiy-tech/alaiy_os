import type { Period } from "@/types/list";
import type { PurchaseOrdersOverview } from "@/types/purchase-orders";

async function getMessage<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
  const data = (await res.json()) as { message: T };
  return data.message;
}

export function getPurchaseOrdersOverview(period: Period) {
  return getMessage<PurchaseOrdersOverview>(
    `/api/method/alaiy_os.api.purchase_order_stats.get_purchase_orders_overview?period=${period}`,
  );
}

export function getPurchaseOrderStatuses() {
  return getMessage<string[]>("/api/method/alaiy_os.api.purchase_order_stats.get_order_statuses");
}
