import type { FrappeListFilter } from "./frappe-list";

/**
 * The declarative contract for `frappe-count` - a tiny sibling of
 * `frappe-list` for "how many rows match this filter," not a general
 * aggregation/query mechanism. Reuses `FrappeListFilter` (`frappe-list.ts`)
 * so the two source types share one filter vocabulary. See
 * `runtime/data/frappe-count-resolver.ts` for what turns this into a real
 * request, and `config/frappe-count-schema.ts` for its validation.
 *
 * Unlike `FrappeListSourceConfig`, there is no standalone-registration use
 * case for this type (only ever resolved inline via `resolver.ts`'s
 * dispatch), so it has no `id`/`description` at all.
 */
export type FrappeCountSourceConfig = {
  type: "frappe-count";
  doctype: string;
  filters?: FrappeListFilter[];
};
