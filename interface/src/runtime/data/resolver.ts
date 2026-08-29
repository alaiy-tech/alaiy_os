import { ORDER_BY_PATTERN, parseOrderByFields } from "@/config/data-request-schema";
import type { DataDefinition } from "@/types/runtime/data-definition";
import type { DataRequest, FrappeFilter } from "@/types/runtime/data-request";
import type { DataSourceContext } from "@/types/runtime/data-source";
import type { UINode } from "@/types/runtime/node";
import type { UIPageDefinition } from "@/types/runtime/page";

import { isComponentNode, isLayoutNode } from "../node";
import { getDataSource } from "../registry/data-source-registry";
import { executeRequest } from "./frappe-request-executor";
import { PAGE_DATA_PREFIX } from "./resolve-data-source";
import { applyTransforms, toResolvedValue } from "./transform-engine";

/** Collects every distinct registered-source id a `{ source }` binding
 * references (domain-specific sources only now - see
 * `runtime/registry/data-source-registry.ts` - every generic data need is a
 * named `page.data` entry instead). A plain `Set`: a string id is already
 * its own stable dedup key, no stringify-for-dedup needed. */
function collectStringSources(node: UINode, collected: Set<string>): void {
  if (isComponentNode(node)) {
    for (const ref of Object.values(node.data ?? {})) {
      if ("source" in ref) collected.add(ref.source);
    }
    for (const child of node.children ?? []) collectStringSources(child, collected);
  } else if (isLayoutNode(node)) {
    for (const child of node.children) collectStringSources(child, collected);
  }
}

const PERIOD_TO_DAYS: Record<string, number> = { "1D": 1, "1W": 7, "1M": 30, "1Y": 365 };

/** Reads the site's one global period toggle (`?period=`, the same
 * convention `components/derived/list/period.ts`'s `readPeriod` and every
 * `os-period-toggle`/`os-filter-bar` period select already use) - not a new
 * per-definition concept. */
function readGlobalPeriod(searchParams: DataSourceContext["searchParams"]): string {
  const raw = searchParams.period;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value in PERIOD_TO_DAYS ? value : "1M";
}

function periodStartDate(period: string): string {
  const days = PERIOD_TO_DAYS[period] ?? 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Substitutes the two recognised sentinels - `"$period"` (the raw period
 * string) and `"$period_start"` (an approximate ISO date, day-counts not
 * calendar-exact) - wherever they appear as a plain string value in a
 * request's filter values or method args. Not a template language: exactly
 * these two literals, nothing else is ever substituted. */
function substituteSentinel(value: unknown, period: string): unknown {
  if (value === "$period") return period;
  if (value === "$period_start") return periodStartDate(period);
  return value;
}

function substituteRequestSentinels(request: DataRequest, period: string): DataRequest {
  if (request.operation === "list") {
    return {
      ...request,
      params: {
        ...request.params,
        filters: request.params.filters?.map((filter) => ({
          ...filter,
          value: substituteSentinel(filter.value, period) as FrappeFilter["value"],
        })),
      },
    };
  }
  if (request.operation === "method") {
    return {
      ...request,
      args: request.args
        ? (Object.fromEntries(
            Object.entries(request.args).map(([key, value]) => [key, substituteSentinel(value, period)]),
          ) as Record<string, string | number | boolean | null>)
        : request.args,
    };
  }
  return request;
}

/** Reads `` `?<name>_page=` `` for a named entry - an invalid/missing value
 * falls through to the request's own default. Only meaningful for a `list`
 * operation with `query.pagination` declared - a source needs a name to get
 * URL-addressable pagination at all. */
function readNamedPage(searchParams: DataSourceContext["searchParams"], name: string): number | undefined {
  const raw = searchParams[`${name}_page`];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : undefined;
}

/** Reads `` `?<name>_sort=` `` - the same `"fieldname asc|desc"` format
 * `orderBy` itself uses. The actual security boundary: the value must match
 * `ORDER_BY_PATTERN` *and* every referenced field must be one of the
 * request's own declared fields or `"name"` - an arbitrary URL-supplied
 * field must never reach Frappe unchecked. */
function readNamedSort(
  searchParams: DataSourceContext["searchParams"],
  name: string,
  request: Extract<DataRequest, { operation: "list" }>,
): string | undefined {
  const raw = searchParams[`${name}_sort`];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !ORDER_BY_PATTERN.test(value)) return undefined;

  const allowedFields = new Set([...request.params.fields, "name"]);
  return parseOrderByFields(value).every((field) => allowedFields.has(field)) ? value : undefined;
}

function readNamedSearch(searchParams: DataSourceContext["searchParams"], name: string): string | undefined {
  const raw = searchParams[`${name}_search`];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** Reads `` `?<name>_filter_<field>=` `` for each field `query.filters`
 * declares - the field name/operator are always author-declared, never
 * taken from the URL, so only the *value* is request-driven. `like`/
 * `not like` values are auto-wrapped in `%...%` (live end-user text, unlike
 * a request's own static filters, which are developer-authored literal
 * values). */
function readNamedFilters(
  searchParams: DataSourceContext["searchParams"],
  name: string,
  queryFilters: { field: string; operator: FrappeFilter["operator"] }[] | undefined,
): FrappeFilter[] {
  return (queryFilters ?? []).flatMap((queryFilter): FrappeFilter[] => {
    const raw = searchParams[`${name}_filter_${queryFilter.field}`];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = value?.trim();
    if (!trimmed) return [];

    const isWildcard = queryFilter.operator === "like" || queryFilter.operator === "not like";
    return [{ field: queryFilter.field, operator: queryFilter.operator, value: isWildcard ? `%${trimmed}%` : trimmed }];
  });
}

/** Resolves one named `page.data` entry: substitutes the global period
 * sentinel, reads request-driven query state (page/sort/search/filters -
 * only for a `list` operation with a `query` declared), executes the
 * request, then runs its `transform` pipeline. */
async function resolveDataDefinition(
  name: string,
  definition: DataDefinition,
  context: DataSourceContext,
): Promise<unknown> {
  const period = readGlobalPeriod(context.searchParams);
  let request = substituteRequestSentinels(definition.request, period);
  let orFilters: FrappeFilter[] | undefined;
  const paginate = Boolean(definition.query?.pagination) && request.operation === "list";

  if (request.operation === "list" && definition.query) {
    const page = readNamedPage(context.searchParams, name) ?? request.params.page ?? 1;
    const orderBy = readNamedSort(context.searchParams, name, request) ?? request.params.orderBy;
    const dynamicFilters = readNamedFilters(context.searchParams, name, definition.query.filters);
    const searchTerm = readNamedSearch(context.searchParams, name);
    orFilters =
      searchTerm && definition.query.search
        ? definition.query.search.fields.map((field) => ({
            field,
            operator: "like" as const,
            value: `%${searchTerm}%`,
          }))
        : undefined;

    request = {
      ...request,
      params: {
        ...request.params,
        page,
        orderBy,
        filters: [...(request.params.filters ?? []), ...dynamicFilters],
      },
    };
  }

  const rawContext = await executeRequest(request, { orFilters, paginate });
  const transformed = applyTransforms(rawContext, definition.transform);
  return toResolvedValue(transformed);
}

async function resolveNamedData(
  data: Record<string, DataDefinition> | undefined,
  context: DataSourceContext,
): Promise<[string, unknown][]> {
  return Promise.all(
    Object.entries(data ?? {}).map(
      async ([name, definition]) =>
        [`${PAGE_DATA_PREFIX}${name}`, await resolveDataDefinition(name, definition, context)] as const,
    ),
  );
}

/**
 * Walks a definition, resolves every distinct registered-source id any
 * node's `data` map references (domain-specific business logic, via the
 * Data Source Registry), and separately resolves the page's own named
 * `data` dict (`resolveNamedData`) - each exactly once, regardless of how
 * many component bindings `{ ref, path? }` into it. The result is the same
 * flat `Record<string, unknown>` `UIRenderer` has always taken as its
 * `data` prop, keyed by a source's bare id (registered) or
 * `` `${PAGE_DATA_PREFIX}<name>` `` (named entries).
 */
export async function resolvePageData(
  definition: UIPageDefinition,
  context: DataSourceContext,
): Promise<Record<string, unknown>> {
  const collected = new Set<string>();
  for (const child of definition.children) collectStringSources(child, collected);

  const [registeredEntries, namedEntries] = await Promise.all([
    Promise.all([...collected].map(async (id) => [id, await getDataSource(id)?.resolve(context)] as const)),
    resolveNamedData(definition.data, context),
  ]);

  return Object.fromEntries([...registeredEntries, ...namedEntries]);
}
