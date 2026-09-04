// Server-only: the detail page is a Server Component, so it calls Frappe
// directly (forwarding the request's cookies) instead of looping back through
// this app's own /api/method proxy. Never import this from a "use client" module.
import type { PurchaseOrderDetail } from "@/types/purchase-orders";

import { frappeFetch } from "./server";

/** Returns null for a missing order (Frappe answers 404) and for a permission
 * failure (403) alike — the page turns either into notFound(), which is the
 * right answer for both: "there is no such order here, for you". */
export async function getPurchaseOrderDetailServer(name: string): Promise<PurchaseOrderDetail | null> {
  const res = await frappeFetch(
    `/api/method/alaiy_os.api.purchase_order.get_purchase_order_detail?name=${encodeURIComponent(name)}`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as { message?: PurchaseOrderDetail };
  return data.message ?? null;
}
