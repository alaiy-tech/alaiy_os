// Server-only: called via frappeFetch (direct to Frappe, forwarding the
// request's cookies). Consumed by `runtime/data/sources/products.ts`'s
// `products` data source. The removed `/os/products` page fetched Item rows
// from the browser (`obsolete/data/lib/frappe/item-list.ts`) because its
// table was a client-side, user-configurable list; a UI-runtime page resolves
// its data server-side, so the same `/api/resource/Item` call moves here.
import type { ItemListFields } from "@/types/products";

import { frappeFetch } from "./server";

const ITEM_LIST_FIELDS: (keyof ItemListFields)[] = [
  "name",
  "item_code",
  "item_name",
  "item_group",
  "stock_uom",
  "standard_rate",
  "disabled",
  "has_variants",
  "variant_of",
  "creation",
];

/** Frappe's `/api/resource` default page length is 20 - the table paginates
 * client-side over whatever this returns, so it asks for a full working set
 * rather than a screen's worth. */
const ITEM_LIST_PAGE_LENGTH = 500;

export async function getItemsServer(): Promise<ItemListFields[] | null> {
  const query = new URLSearchParams({
    fields: JSON.stringify(ITEM_LIST_FIELDS),
    order_by: "modified desc",
    limit_page_length: String(ITEM_LIST_PAGE_LENGTH),
  });

  const res = await frappeFetch(`/api/resource/Item?${query.toString()}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: ItemListFields[] };
  return data.data ?? [];
}
