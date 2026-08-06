import { ORDER_BY_PATTERN, parseOrderByFields } from "@/config/frappe-list-schema";
import type { DataSourceContext } from "@/types/runtime/data-source";
import type { DataSourceValue } from "@/types/runtime/data-source-ref";
import type { FrappeCountSourceConfig } from "@/types/runtime/frappe-count";
import type { FrappeListFilter, FrappeListSourceConfig } from "@/types/runtime/frappe-list";
import type { UINode } from "@/types/runtime/node";
import type { UIPageDefinition } from "@/types/runtime/page";

import { isComponentNode, isLayoutNode } from "../node";
import { resolveFrappeCount } from "./frappe-count-resolver";
import { createFrappeListSource } from "./frappe-list-resolver";
import { getDataSource } from "./registry";
import { PAGE_DATA_PREFIX, sourceKey } from "./resolve-data-source";

/** Collects every unique `{ source, path? }`-shaped `DataSourceRef` a
 * definition references, keyed by `sourceKey` - a `Map`, not a `Set`,
 * because an inline source has no name of its own to carry forward; the
 * actual config has to travel with its key so `resolveSource` has
 * something to dispatch on. `{ ref, path? }`-shaped bindings are skipped
 * here entirely - they reference a *named* entry from `definition.data`,
 * resolved separately by `resolveNamedData` below. */
function collectSources(node: UINode, collected: Map<string, DataSourceValue>): void {
  if (isComponentNode(node)) {
    for (const ref of Object.values(node.data ?? {})) {
      if ("source" in ref) collected.set(sourceKey(ref.source), ref.source);
    }
    for (const child of node.children ?? []) collectSources(child, collected);
  } else if (isLayoutNode(node)) {
    for (const child of node.children) collectSources(child, collected);
  }
}

/**
 * Turns one `DataSourceRef.source` into a value. A string resolves through
 * the unchanged Data Source Registry (`dashboard`/`customers` and any other
 * named, domain-specific source) - unregistered still safely degrades to
 * `undefined`, never throws. An inline declarative config
 * (`FrappeListSourceConfig`/`FrappeCountSourceConfig`) has no registry id to
 * look up, so it dispatches on its own `type` instead - a closed switch,
 * exhaustively checked (`never`), so wiring up a future third inline type
 * without adding a case here is a compile error, not silent `undefined` at
 * runtime. Deliberately lives here, not in `registry.ts`: `getDataSource`
 * is a narrow, id-keyed lookup with other real callers
 * (`resolve-page.tsx`'s `isDataSourceRegistered`) that only ever pass a
 * string - an inline config isn't a registry concept, so the dispatch
 * belongs with the one thing that already turns "whatever `DataSourceRef` I
 * found while walking the tree" into "a value."
 *
 * Only ever reached for an *anonymous* inline binding now - a named
 * `definition.data` entry's `frappe-list` config is resolved directly by
 * `resolveNamedData` below (it needs to pass request-derived `orFilters`
 * that this generic dispatcher has no reason to know about). That's also
 * why an anonymous `frappe-list` config's `search`/`queryFilters` are inert:
 * this is the one place that would matter, and it never reads
 * `context.searchParams` at all - hence the dev warning below.
 */
async function resolveSource(source: DataSourceValue, context: DataSourceContext): Promise<unknown> {
  if (typeof source === "string") {
    const registered = getDataSource(source);
    return registered ? registered.resolve(context) : undefined;
  }

  switch (source.type) {
    case "frappe-list":
      if (process.env.NODE_ENV !== "production" && (source.search || source.queryFilters?.length)) {
        console.warn(
          'frappe-list: "search"/"queryFilters" on an anonymous inline binding have no effect - only a ' +
            "named definition.data entry's <name>_search/<name>_filter_<field> URL params are read. " +
            'Give this source a page-level name (see docs/UI_RUNTIME.md\'s "Paginated Data Sources") to make it interactive.',
        );
      }
      return createFrappeListSource(source).resolve(context);
    case "frappe-count":
      return resolveFrappeCount(source);
    default: {
      const _exhaustive: never = source;
      return undefined;
    }
  }
}

/** Reads `?<name>_page=` for a named page-data entry - e.g. `"customers"` ->
 * `?customers_page=`, mirroring `readPeriod`'s validation shape (an
 * invalid/missing value falls through to the config's own default). This is
 * the ONLY place a page number is read from the URL: a source must have an
 * explicit name (a `definition.data` key) to get URL-addressable pagination
 * at all - an anonymous inline `frappe-list` binding always uses its own
 * static `config.pagination.page`, deliberately (see `page.ts`'s doc
 * comment on why no-name means no interactivity, not an auto-picked
 * default). */
function readNamedPage(searchParams: DataSourceContext["searchParams"], name: string): number | undefined {
  const raw = searchParams[`${name}_page`];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : undefined;
}

/** Reads `` `?<name>_sort=` `` for a named `frappe-list` entry - the same
 * literal `"fieldname asc|desc"` format `orderBy` itself already uses, so a
 * URL value and the config's own default are interchangeable. This is the
 * actual security/correctness boundary for request-driven sorting: the
 * value must match `ORDER_BY_PATTERN` *and* every field it references must
 * be one of `config.fields` or `"name"` - an arbitrary URL-supplied field
 * must never reach Frappe unchecked. Invalid or absent falls back to
 * `config.orderBy` (which may itself be `undefined`). */
function readNamedSort(
  searchParams: DataSourceContext["searchParams"],
  name: string,
  config: FrappeListSourceConfig,
): string | undefined {
  const raw = searchParams[`${name}_sort`];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !ORDER_BY_PATTERN.test(value)) return undefined;

  const allowedFields = new Set([...config.fields, "name"]);
  return parseOrderByFields(value).every((field) => allowedFields.has(field)) ? value : undefined;
}

/** Reads `` `?<name>_search=` `` for a named `frappe-list` entry - a plain
 * trimmed term, empty/absent -> `undefined`. Only meaningful when the
 * entry's own config declares `search.fields` (see `resolveNamedData`
 * below); this function itself doesn't know or care whether it does. */
function readNamedSearch(searchParams: DataSourceContext["searchParams"], name: string): string | undefined {
  const raw = searchParams[`${name}_search`];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** Reads `` `?<name>_filter_<field>=` `` for each field a named entry's
 * `config.queryFilters` declares - the field name (and its operator) is
 * always author-declared config, never taken from the URL, so this can
 * never inject an arbitrary field; only the *value* is request-driven.
 * `like`/`not like` values are auto-wrapped in `%...%` - a deliberate,
 * narrowly-scoped exception to `frappe-list`'s general "no wildcard
 * injection" rule (see `FrappeListFilter`'s doc comment): this value is
 * live end-user text arriving through a URL param, the same class of input
 * `components/derived/list/types.ts`'s `toFrappeFilters` already
 * auto-wraps, not developer-authored config. Empty/missing values are
 * skipped, matching `readNamedSearch`'s own trim-and-drop behavior. */
function readNamedFilters(
  searchParams: DataSourceContext["searchParams"],
  name: string,
  config: FrappeListSourceConfig,
): FrappeListFilter[] {
  return (config.queryFilters ?? []).flatMap((queryFilter): FrappeListFilter[] => {
    const raw = searchParams[`${name}_filter_${queryFilter.field}`];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = value?.trim();
    if (!trimmed) return [];

    const isWildcard = queryFilter.operator === "like" || queryFilter.operator === "not like";
    return [{ field: queryFilter.field, operator: queryFilter.operator, value: isWildcard ? `%${trimmed}%` : trimmed }];
  });
}

/** Resolves every entry of `definition.data` (`types/runtime/page.ts`'s
 * page-level named source dictionary) once each, keyed by
 * `` `${PAGE_DATA_PREFIX}${name}` `` - a keyspace deliberately separate
 * from `sourceKey`'s (see `page.ts`'s doc comment). A named `frappe-list`
 * entry's page number, sort, filters, and search are all request-aware
 * (`readNamedPage`/`readNamedSort`/`readNamedFilters`/`readNamedSearch`); a
 * `frappe-count` entry has no pagination/query-state concept and resolves
 * as configured. The `frappe-list` branch calls `createFrappeListSource`
 * directly rather than through the generic `resolveSource` dispatcher -
 * this is the one place `orFilters` (the search term's derived OR-filter
 * tuples) needs to flow, and it's derived here, not carried on the config
 * (see `createFrappeListSource`'s doc comment for why). */
async function resolveNamedData(
  data: Record<string, FrappeListSourceConfig | FrappeCountSourceConfig> | undefined,
  context: DataSourceContext,
): Promise<[string, unknown][]> {
  return Promise.all(
    Object.entries(data ?? {}).map(async ([name, config]) => {
      if (config.type === "frappe-list") {
        const page = readNamedPage(context.searchParams, name) ?? config.pagination.page ?? 1;
        const orderBy = readNamedSort(context.searchParams, name, config) ?? config.orderBy;
        const dynamicFilters = readNamedFilters(context.searchParams, name, config);
        const searchTerm = readNamedSearch(context.searchParams, name);
        const orFilters: FrappeListFilter[] | undefined =
          searchTerm && config.search
            ? config.search.fields.map((field) => ({ field, operator: "like" as const, value: `%${searchTerm}%` }))
            : undefined;

        const effectiveConfig: FrappeListSourceConfig = {
          ...config,
          pagination: { ...config.pagination, page },
          orderBy,
          filters: [...(config.filters ?? []), ...dynamicFilters],
          // Stripped, not carried forward: `queryFilters`/`search` are
          // capability declarations already consumed above (by
          // `readNamedFilters`/`readNamedSearch`) - `frappe-list-resolver.ts`
          // never reads either field. Keeping them here would make
          // `createFrappeListSource`'s own re-validation of *this* merged
          // config re-run the schema's "a field can't be in both `filters`
          // and `queryFilters`" check - which exists to catch an *author's*
          // static-config mistake, not this deliberate runtime merge (a
          // `queryFilters`-declared field legitimately lands in `filters`
          // once a value for it is supplied).
          queryFilters: undefined,
          search: undefined,
        };
        return [
          `${PAGE_DATA_PREFIX}${name}`,
          await createFrappeListSource(effectiveConfig, { orFilters }).resolve(context),
        ] as const;
      }
      return [`${PAGE_DATA_PREFIX}${name}`, await resolveSource(config, context)] as const;
    }),
  );
}

/**
 * Replaces the hand-written per-page `loadData` function: walks a
 * definition, collects every unique data source any node's `data` map
 * references (via `resolve-data-source.ts`'s `DataSourceRef.source` - either
 * a named registry id or an inline declarative config), resolves each one
 * exactly once via `resolveSource` in parallel, and separately resolves the
 * page's own named `data` dict (`resolveNamedData`) - also each exactly
 * once, regardless of how many component bindings `{ ref, path? }` into it.
 * The result is the same flat `Record<string, unknown>` `UIRenderer` has
 * always taken as its `data` prop, keyed by `sourceKey` (anonymous
 * bindings) or `` `${PAGE_DATA_PREFIX}<name>` `` (named entries) so
 * `resolveDataSource` (called at render time) looks values back up under
 * the identical key - only *how that object gets built* changes here, not
 * its shape or how `UIRenderer` consumes it.
 *
 * Because this only ever resolves sources the definition itself references,
 * a page's JSON stays the single source of truth for what data it needs -
 * there's no separate loader function to keep in sync with the JSON by hand,
 * and a genuinely new page with no registered feature code still renders
 * (any unregistered string source id still contributes `undefined` - the
 * same safe-degradation the renderer already applies to an unknown
 * component `type`).
 */
export async function resolvePageData(
  definition: UIPageDefinition,
  context: DataSourceContext,
): Promise<Record<string, unknown>> {
  const collected = new Map<string, DataSourceValue>();
  for (const child of definition.children) collectSources(child, collected);

  const [anonymousEntries, namedEntries] = await Promise.all([
    Promise.all(
      [...collected.entries()].map(async ([key, source]) => [key, await resolveSource(source, context)] as const),
    ),
    resolveNamedData(definition.data, context),
  ]);

  return Object.fromEntries([...anonymousEntries, ...namedEntries]);
}
