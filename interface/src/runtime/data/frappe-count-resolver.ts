import { frappeFetch } from "@/lib/frappe/server";
import type { FrappeCountSourceConfig } from "@/types/runtime/frappe-count";

import { toFrappeFilterTuples } from "./frappe-list-resolver";

/**
 * The generic `frappe-count` mechanism - a tiny sibling of `frappe-list` for
 * "how many rows match this filter," used inline from a KPI's `data`
 * binding (`runtime/data/resolver.ts`'s dispatch), never standalone-
 * registered. Hits `/api/method/frappe.client.get_count` via the same
 * `frappeFetch` BFF call every other server-side fetcher uses - the exact
 * endpoint `src/lib/frappe/logs.ts`'s `fetchLogCount` already proves out
 * for a different doctype. No validate-or-throw guard here: unlike
 * `createFrappeListSource` (which has a second, non-zod-validated
 * standalone-registration call path), this is only ever reached after
 * `validatePageConfig` has already zod-validated the whole page - a second
 * check here would be dead code, not defense in depth.
 */
export async function resolveFrappeCount(config: FrappeCountSourceConfig): Promise<number> {
  const query = new URLSearchParams();
  query.set("doctype", config.doctype);
  if (config.filters?.length) {
    query.set("filters", JSON.stringify(toFrappeFilterTuples(config.filters)));
  }

  const res = await frappeFetch(`/api/method/frappe.client.get_count?${query.toString()}`);
  if (!res.ok) return 0;

  const body = (await res.json()) as { message?: number };
  return body.message ?? 0;
}
