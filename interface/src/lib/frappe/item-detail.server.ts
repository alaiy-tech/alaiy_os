// Server-only: the detail page is a Server Component, so it calls Frappe
// directly (forwarding the request's cookies) instead of looping back through
// this app's own /api/method proxy. Never import this from a "use client" module.
import type { ItemDetail } from "@/types/products";

import { frappeFetch } from "./server";

/** Returns null for a missing item (Frappe answers 404) and for a permission
 * failure (403) alike — the page turns either into notFound(), which is the
 * right answer for both: "there is no such item here, for you". */
export async function getItemDetailServer(name: string): Promise<ItemDetail | null> {
  const res = await frappeFetch(`/api/method/alaiy_os.api.item.get_item_detail?name=${encodeURIComponent(name)}`);
  if (!res.ok) return null;

  const data = (await res.json()) as { message?: ItemDetail };
  return data.message ?? null;
}
