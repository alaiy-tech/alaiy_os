import { FRAPPE_LIST_SOURCE_CONFIG_SCHEMA } from "@/config/frappe-list-schema";
import { frappeFetch } from "@/lib/frappe/server";
import type { DataSourceDefinition, DataSourceField } from "@/types/runtime/data-source";
import type {
  FrappeListFilter,
  FrappeListFilterOperator,
  FrappeListResult,
  FrappeListSourceConfig,
} from "@/types/runtime/frappe-list";

/**
 * The generic `frappe-list` mechanism: turns a declarative
 * `FrappeListSourceConfig` into a real `DataSourceDefinition`, so an
 * ordinary "list this DocType's rows" requirement doesn't need a new
 * page-specific fetcher under `src/lib/frappe/`. Reaches Frappe through the
 * same `frappeFetch` every existing `*.server.ts` fetcher already uses - no
 * second HTTP client, no new API route, same cookie-forwarded session
 * Frappe stays authoritative over. Lives beside `registry.ts`/`resolver.ts`/
 * `resolve-data-source.ts` (generic data-layer infrastructure) rather than
 * in `sources/`, which is reserved for concrete files that call
 * `registerDataSource` at module scope as a production side effect - this
 * file deliberately does not do that.
 *
 * Two call paths reach this factory: `runtime/data/resolver.ts`'s inline
 * dispatch (a page definition declares a `frappe-list` config directly in a
 * `data` binding, `id`/`description` omitted - the primary path this exists
 * for), and a hypothetical future standalone `sources/<page>.ts` calling
 * `registerDataSource(createFrappeListSource({id, description, ...}))` for
 * a *named*, reusable generic source (`id`/`description` supplied).
 *
 * This file has no `searchParams`/request awareness at all - `resolve()`
 * only ever uses `config.pagination.page`/`config.filters`/`config.orderBy`
 * as given. Request-driven paging, filtering, search, and sorting (reading
 * `?<name>_page=`/`?<name>_filter_<field>=`/`?<name>_search=`/`?<name>_sort=`
 * URL params) all live one layer up, in `resolver.ts`, which is the only
 * place that knows a source's *name* (a page-level `data` dict key) - the
 * one thing that makes a namespaced URL param safe. An earlier version of
 * this file read a flat, unnamespaced `?page=` here directly; that's
 * exactly the bug fixed by moving this concern up a layer - independent
 * `frappe-list` bindings on one page no longer fight over the same URL
 * param, because this file never looks at the URL at all. The one exception
 * is `or_filters` (`createFrappeListSource`'s second `options` parameter,
 * below): it's derived request-time state too, but it deliberately does
 * NOT round-trip through `FrappeListSourceConfig`/its zod schema - see that
 * function's doc comment for why.
 */

function titleCase(fieldName: string): string {
  return fieldName
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** `[field, operator, value]` triples - Frappe's own REST filter shape.
 * Shared with `frappe-count-resolver.ts` so the tuple mapping can't drift
 * between the two source types. */
export function toFrappeFilterTuples(
  filters: FrappeListFilter[] | undefined,
): Array<[string, FrappeListFilterOperator, FrappeListFilter["value"]]> {
  return (filters ?? []).map((f) => [f.field, f.operator, f.value]);
}

/**
 * Pure request-path builder, exported separately so it's unit-testable
 * without mocking `fetch`. Matches `lib/frappe/logs.ts`'s `fetchLogRows` -
 * the closest existing precedent for hitting Frappe's standard doctype REST
 * endpoint directly (as opposed to a custom whitelisted method): a
 * `URLSearchParams` query against `/api/resource/<Doctype>`, doctype
 * `encodeURIComponent`-ed since Frappe doctype names routinely contain
 * spaces ("Sales Order").
 */
export function buildFrappeListRequestPath(config: FrappeListSourceConfig, orFilters?: FrappeListFilter[]): string {
  const page = config.pagination.page ?? 1;
  const pageSize = config.pagination.pageSize;

  // "name" is every doctype's primary key - always requested even if the
  // config omits it, so a resolved row is never missing a stable id.
  const fields = Array.from(new Set(["name", ...config.fields]));

  const query = new URLSearchParams();
  query.set("fields", JSON.stringify(fields));
  if (config.filters?.length) {
    // No wildcard injection for like/not like - see FrappeListFilter's doc
    // comment. Values are passed through to Frappe exactly as configured.
    query.set("filters", JSON.stringify(toFrappeFilterTuples(config.filters)));
  }
  if (orFilters?.length) {
    // Combines with `filters` above as `filters AND (or_filters)` - Frappe's
    // own REST convention (precedented in this codebase's obsolete
    // `supplier-list.ts`/`sales-order-list.ts` fetchers against this exact
    // endpoint), giving the expected "narrow further within the filtered
    // set" search-box semantics. Never author-supplied - see
    // `createFrappeListSource`'s doc comment for why this arrives as a
    // parameter rather than a `config` field.
    query.set("or_filters", JSON.stringify(toFrappeFilterTuples(orFilters)));
  }
  if (config.orderBy) query.set("order_by", config.orderBy);
  // 1-indexed `page` - a new convention for this codebase, nothing else
  // here has a "page number" concept to conflict with.
  query.set("limit_start", String((page - 1) * pageSize));
  // Fetch one extra row - the standard trick for computing `hasMore`
  // without a separate count call, since Frappe's list endpoint returns no
  // total by default (frappe.client.get_count is the real API a future
  // frappe-count source would wrap - not built here).
  query.set("limit_page_length", String(pageSize + 1));

  return `/api/resource/${encodeURIComponent(config.doctype)}?${query.toString()}`;
}

/**
 * Validates `config`, then returns a `DataSourceDefinition` ready to
 * `registerDataSource()`. Throws a plain `Error` on an invalid config -
 * fail-fast at whatever call site invokes this factory, since a
 * misconfigured source is a developer mistake to catch immediately, not a
 * request-time condition.
 *
 * `options.orFilters` carries the search term's derived OR-filter tuples
 * (built by `runtime/data/resolver.ts`'s `resolveNamedData` from a named
 * entry's `` `${name}_search` `` URL param and its own `config.search.fields`)
 * - deliberately a *separate parameter*, not a `config` field: unlike
 * `pagination.page` (a value an author may legitimately set as a static
 * default), `orFilters` has no legitimate author-facing use - it's pure
 * request-derived state. Putting it in the `.strict()`-validated
 * `FrappeListSourceConfig`/`FRAPPE_LIST_SOURCE_CONFIG_SCHEMA` vocabulary
 * would let an author hand-write it in page JSON, which `resolveNamedData`
 * would then silently clobber on every single request.
 */
export function createFrappeListSource(
  config: FrappeListSourceConfig,
  options?: { orFilters?: FrappeListFilter[] },
): DataSourceDefinition<FrappeListResult> {
  const validated = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(config);
  if (!validated.success) {
    // `config.id ?? config.doctype`, not just `config.id`: an inline config
    // (the primary use case) never sets `id`, so the message stays legible
    // instead of printing `"undefined"`.
    throw new Error(
      `Invalid frappe-list source config for "${config.id ?? config.doctype}": ${validated.error.message}`,
    );
  }

  // Disclosed simplification: no DocType meta fetch (out of scope - "do not
  // attempt full DocType metadata validation"), so `label`/`type` are
  // synthesized rather than sourced from Frappe's own field definitions.
  const fields: DataSourceField[] = config.fields.map((name) => ({
    name,
    label: titleCase(name),
    type: "string",
  }));

  // Synthesized when omitted (the inline-config case) - see the module doc
  // comment above.
  const id = config.id ?? `frappe-list:${config.doctype}`;
  const description = config.description ?? `Generic list of ${config.doctype}`;

  return {
    id,
    description,
    // Fixed regardless of what this particular instance's config sets -
    // capabilities already mean "what kind of source this mechanically is"
    // elsewhere in this codebase (`customers` claims filter/sort/pagination
    // even though its own resolve() takes no params), and every frappe-list
    // instance is mechanically list/filterable/sortable/paginated by
    // construction. No `search` - Frappe's list endpoint has no full-text
    // search param, so claiming it would be false. No `detail`/`aggregate` -
    // out of scope for this source type.
    capabilities: { list: true, filter: true, sort: true, pagination: true },
    fields,
    async resolve(): Promise<FrappeListResult> {
      const page = config.pagination.page ?? 1;
      const pageSize = config.pagination.pageSize;

      const res = await frappeFetch(buildFrappeListRequestPath(config, options?.orFilters));
      if (!res.ok) {
        // Never throw here - matches getCustomersServer's/
        // getCustomersOverviewServer's silent-null convention for
        // server-side fetchers reached through resolvePageData (as opposed
        // to lib/frappe/logs.ts's throwing behavior, which is a
        // client-side fetch pattern with its own error boundary - not the
        // precedent to follow for a source resolve()).
        return { data: [], pagination: { page, pageSize, hasMore: false }, orderBy: config.orderBy };
      }

      const body = (await res.json()) as { data?: Record<string, unknown>[] };
      const rows = body.data ?? [];
      const hasMore = rows.length > pageSize;

      return {
        data: hasMore ? rows.slice(0, pageSize) : rows,
        pagination: { page, pageSize, hasMore },
        orderBy: config.orderBy,
      };
    },
  };
}
