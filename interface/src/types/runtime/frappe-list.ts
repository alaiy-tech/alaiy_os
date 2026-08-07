/** The declarative contract for `frappe-list` - a generic data source that
 * describes an ordinary Frappe DocType list request (fields, basic filters,
 * ordering, pagination) without a page-specific fetcher. See
 * `runtime/data/frappe-list-resolver.ts` for what turns this into a real
 * request, and `config/frappe-list-schema.ts` for its validation. */

import type { FilterOperator } from "@/types/list";

/** A restricted subset of the existing `FilterOperator` vocabulary
 * (`types/list.ts`) - "between", "is", "is not" need a different value
 * shape (a two-item range; Frappe's literal "set"/"not set" sentinel) than
 * an ordinary list filter needs, so they're deferred rather than supported
 * from day one. */
export type FrappeListFilterOperator = Extract<
  FilterOperator,
  "=" | "!=" | "like" | "not like" | ">" | "<" | ">=" | "<=" | "in" | "not in"
>;

/** `queryFilters`' own operator vocabulary - `FrappeListFilterOperator` minus
 * `in`/`not in`: a request-driven filter value comes from one URL param
 * (`` `${name}_filter_<field>` ``, see `runtime/data/resolver.ts`), and no
 * UI here produces a comma-separated/array value for it - only a scalar. */
export type FrappeListQueryFilterOperator = Extract<
  FrappeListFilterOperator,
  "=" | "!=" | "like" | "not like" | ">" | "<" | ">=" | "<="
>;

/** Mirrors `FilterRow`'s `{ field, operator, value }` shape (`types/list.ts`),
 * but widens `value` beyond a plain string - this feeds a real Frappe query,
 * not an end-user text input, so `in`/`not in` need an array. No `boolean`
 * yet: Frappe `Check` fields query as `0`/`1`, not JSON `true`/`false`, and
 * nothing in this codebase exercises that path today to confirm the mapping
 * against - add it once verified, not as a guess. */
export type FrappeListFilter = {
  field: string;
  operator: FrappeListFilterOperator;
  /** Array only valid for `in`/`not in`; every other operator takes a
   * scalar. No wildcard injection happens for `like`/`not like` - unlike
   * the end-user-facing `toFrappeFilters` (`components/derived/list/types.ts`),
   * which auto-wraps `%value%`, a `frappe-list` config is developer-authored,
   * so the author writes the literal Frappe value, `%` included if wanted. */
  value: string | number | (string | number)[];
};

export type FrappeListPagination = {
  /** Max rows per page. Capped by `config/frappe-list-schema.ts`. */
  pageSize: number;
  /** 1-indexed; defaults to 1. A new convention for this codebase - nothing
   * else here has a "page number" concept to conflict with. */
  page?: number;
};

/** The full declarative config a `frappe-list` source is created from
 * (`runtime/data/frappe-list-resolver.ts`'s `createFrappeListSource`).
 * `type` is a discriminator, leaving room for a future sibling (e.g.
 * `"frappe-count"`) in the same union without breaking this one. */
export type FrappeListSourceConfig = {
  type: "frappe-list";
  /** Optional: required only when registering this as a standalone, named
   * `DataSourceDefinition` (`registerDataSource(createFrappeListSource({id,
   * description, ...}))`). A config declared inline in a page definition's
   * `data` binding omits both - `createFrappeListSource` synthesizes them
   * from `doctype` instead. */
  id?: string;
  description?: string;
  doctype: string;
  /** Field names to fetch. `"name"` (every doctype's primary key) is always
   * included by the resolver even if omitted here. */
  fields: string[];
  filters?: FrappeListFilter[];
  /** `"fieldname asc|desc"`, comma-separated for multiple fields. */
  orderBy?: string;
  pagination: FrappeListPagination;
  /** Fields a *named* `definition.data` entry (`types/runtime/page.ts`)
   * allows filtering by via a URL param - `` `${name}_filter_<field>` ``,
   * one per declared entry (see `runtime/data/resolver.ts`'s
   * `readNamedFilters`). A capability declaration only: the actual value
   * always comes from the request, never from this config - an anonymous
   * inline binding (no page-level name) can declare this, but it has no
   * effect (`resolver.ts` warns in dev when that happens). A field listed
   * here must not also appear in the static `filters` array above - both
   * would AND together on the same field, silently producing an
   * always-empty result if they disagree (enforced by
   * `config/frappe-list-schema.ts`). */
  queryFilters?: { field: string; operator: FrappeListQueryFilterOperator }[];
  /** Fields a *named* entry allows searching across via
   * `` `${name}_search` `` - mapped to Frappe's `or_filters` as `like`
   * matches, each field's value wildcarded automatically (the term is live
   * end-user text, not developer-authored config - see
   * `runtime/data/resolver.ts`'s `readNamedSearch`/`resolveNamedData`).
   * Same anonymous-binding caveat as `queryFilters` above. */
  search?: { fields: string[] };
};

/** The normalized result every `frappe-list` source resolves to. New for
 * this codebase - no consumer exists yet (`os-data-table`'s `rows` binding
 * expects a bare array today); see `docs/UI_RUNTIME.md`'s "Generic Frappe
 * Data Sources" section for what a real consumer will still need to decide. */
export type FrappeListResult<TRow = Record<string, unknown>> = {
  data: TRow[];
  pagination: {
    page: number;
    pageSize: number;
    /** Whether a further page exists, derived by over-fetching one extra
     * row - Frappe's list endpoint returns no total count by default. */
    hasMore: boolean;
  };
  /** The *effective* `orderBy` this resolution actually used - echoes the
   * config's own `orderBy` after `resolver.ts`'s request-driven substitution
   * (`readNamedSort`), the same way `pagination.page` already echoes its own
   * effective value back. Lets a data-bound `OsDataTable`'s `sort` prop show
   * the correct initial sort-arrow state without re-deriving anything. */
  orderBy?: string;
};
