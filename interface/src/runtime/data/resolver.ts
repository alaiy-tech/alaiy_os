import {
  ORDER_BY_PATTERN,
  parseOrderByFields,
} from "@/config/data-request-schema";
import {
  MANUAL_FILTER_OPERATORS,
  PAGE_SIZE_OPTIONS,
  PERIODS,
} from "@/constants/list";
import type { DocFieldMeta } from "@/types/list";
import type { DataDefinition } from "@/types/runtime/data-definition";
import type { DataRequest, FrappeFilter } from "@/types/runtime/data-request";
import type { DataSourceContext } from "@/types/runtime/data-source";
import type { TransformStep } from "@/types/runtime/data-transform";
import type { UINode } from "@/types/runtime/node";
import type { UIPageDefinition } from "@/types/runtime/page";

import { isComponentNode, isLayoutNode } from "../node";
import { getDataSource } from "../registry/data-source-registry";
import { fetchDoctypeFields } from "./fetch-doctype-fields";
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
    for (const child of node.children ?? [])
      collectStringSources(child, collected);
  } else if (isLayoutNode(node)) {
    for (const child of node.children) collectStringSources(child, collected);
  }
}

const PERIOD_TO_DAYS: Record<string, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "1Y": 365,
};

/** Reads the site's one global period toggle (`?period=`, the same
 * convention `components/derived/list/period.ts`'s `readPeriod` and every
 * `os-period-toggle`/`os-filter-bar` period select already use) - not a new
 * per-definition concept. Falls back to `PERIODS[0]` - `os-period-toggle`
 * treats its first configured option as the default and never writes a
 * `?period=` param for it (a clean URL at the default), so this fallback
 * must resolve to the *same* value or the first server render would show
 * data computed for one period while the toggle highlights another. */
function readGlobalPeriod(
  searchParams: DataSourceContext["searchParams"],
): string {
  const raw = searchParams.period;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value in PERIOD_TO_DAYS ? value : PERIODS[0];
}

function periodStartDate(period: string): string {
  const days = PERIOD_TO_DAYS[period] ?? 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

/** What `group.granularity: "auto"` resolves to for each period - day-level
 * buckets for anything a month or shorter (still a readable number of
 * points: at most ~30), month-level once the window is a year (day-level
 * over 365 days would be unreadable, and 12 points is the same shape the
 * previous hardcoded "always group by month" behavior had). Unrecognised
 * periods fall back to "month", the safest (fewest-points) default. */
const PERIOD_TO_GRANULARITY: Record<string, "day" | "month" | "year"> = {
  "1D": "day",
  "1W": "day",
  "1M": "day",
  "1Y": "month",
};

/** Resolves every `group` step's `granularity: "auto"` to the real
 * day/month/year value for the current period *before* `transform-engine.ts`
 * ever sees it - keeps that module itself fully period-agnostic (a `group`
 * step there just gets a literal granularity, same as it always has),
 * exactly mirroring how `substituteRequestSentinels` resolves `$period`/
 * `$period_start` for a request without `frappe-request-executor.ts` needing
 * to know what a period even is. */
function substituteTransformSentinels(
  steps: TransformStep[] | undefined,
  period: string,
): TransformStep[] | undefined {
  return steps?.map((step) =>
    step.type === "group" && step.granularity === "auto"
      ? { ...step, granularity: PERIOD_TO_GRANULARITY[period] ?? "month" }
      : step,
  );
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

function substituteRequestSentinels(
  request: DataRequest,
  period: string,
): DataRequest {
  if (request.operation === "list") {
    return {
      ...request,
      params: {
        ...request.params,
        filters: request.params.filters?.map((filter) => ({
          ...filter,
          value: substituteSentinel(
            filter.value,
            period,
          ) as FrappeFilter["value"],
        })),
      },
    };
  }
  if (request.operation === "method") {
    return {
      ...request,
      args: request.args
        ? (Object.fromEntries(
            Object.entries(request.args).map(([key, value]) => [
              key,
              substituteSentinel(value, period),
            ]),
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
function readNamedPage(
  searchParams: DataSourceContext["searchParams"],
  name: string,
): number | undefined {
  const raw = searchParams[`${name}_page`];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : undefined;
}

/** Reads `` `?<name>_page_size=` `` for a named entry - only a value from the
 * fixed `PAGE_SIZE_OPTIONS` whitelist is honoured (the same set the
 * per-page `<Select>` offers), so an arbitrary URL-supplied number never
 * reaches Frappe as a page size. An invalid/missing value falls through to
 * the request's own static `params.pageSize`. */
function readNamedPageSize(
  searchParams: DataSourceContext["searchParams"],
  name: string,
): number | undefined {
  const raw = searchParams[`${name}_page_size`];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const size = Number(value);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(size)
    ? size
    : undefined;
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
  return parseOrderByFields(value).every((field) => allowedFields.has(field))
    ? value
    : undefined;
}

function readNamedSearch(
  searchParams: DataSourceContext["searchParams"],
  name: string,
): string | undefined {
  const raw = searchParams[`${name}_search`];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** `MANUAL_FILTER_OPERATORS` (the same whitelist `FilterPopover` restricts
 * itself to for a server-filtered table), as a `Set` for the membership
 * check below. An unrecognised/missing operator falls back to `"="`. */
const SAFE_FILTER_OPERATORS = new Set<FrappeFilter["operator"]>(
  MANUAL_FILTER_OPERATORS,
);

/** Reads `` `?<name>_filter_<field>=` `` (value) and
 * `` `?<name>_filter_<field>_op=` `` (operator) for every field in `fields` -
 * the doctype's own fetched field list (`exposeFields`, required whenever
 * `query.filters` is true - see `data-definition-schema.ts`'s `.refine()`),
 * which is the actual safety boundary here: a URL-supplied field name is
 * only ever honoured if it's genuinely one of this doctype's own fields (the
 * same permission-checked list `os-data-table`'s filter/column popovers
 * already draw from), and a URL-supplied operator only if it's in
 * `SAFE_FILTER_OPERATORS`. Both field *and* operator are request-driven here
 * (unlike a `count`/static request filter) because a table's filter popover
 * now lets a user pick any doctype field and any operator, not just one
 * author-fixed operator per author-declared field. `in`/`not in` split the
 * value on commas - the same convention `FilterPopover`'s own value input
 * already uses. */
function readNamedFilters(
  searchParams: DataSourceContext["searchParams"],
  name: string,
  fields: DocFieldMeta[],
): FrappeFilter[] {
  return fields.flatMap((field): FrappeFilter[] => {
    const raw = searchParams[`${name}_filter_${field.fieldname}`];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = value?.trim();
    if (!trimmed) return [];

    const rawOp = searchParams[`${name}_filter_${field.fieldname}_op`];
    const opValue = Array.isArray(rawOp) ? rawOp[0] : rawOp;
    const operator = (
      opValue && SAFE_FILTER_OPERATORS.has(opValue as FrappeFilter["operator"])
        ? opValue
        : "="
    ) as FrappeFilter["operator"];

    if (operator === "in" || operator === "not in") {
      const values = trimmed
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      return values.length
        ? [{ field: field.fieldname, operator, value: values }]
        : [];
    }
    return [{ field: field.fieldname, operator, value: trimmed }];
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
  const paginate =
    Boolean(definition.query?.pagination) && request.operation === "list";
  const doctype = request.operation !== "method" ? request.doctype : undefined;

  // `query.filters: true` needs the doctype's own field list *before* the
  // request can be built - it's the safety boundary a URL-supplied filter
  // field is checked against (see `readNamedFilters`). Fetched sequentially
  // only in that case, and reused below rather than fetched twice;
  // `exposeFields` alone (no `query.filters`) keeps the original
  // fetch-in-parallel-with-the-request timing, since nothing needs it
  // before building filters then.
  const fieldsForFilters =
    request.operation === "list" && definition.query?.filters && doctype
      ? await fetchDoctypeFields(doctype)
      : undefined;

  if (request.operation === "list" && definition.query) {
    const page =
      readNamedPage(context.searchParams, name) ?? request.params.page ?? 1;
    const pageSize = definition.query.pagination
      ? (readNamedPageSize(context.searchParams, name) ??
        request.params.pageSize)
      : request.params.pageSize;
    const orderBy =
      readNamedSort(context.searchParams, name, request) ??
      request.params.orderBy;
    const dynamicFilters = definition.query.filters
      ? readNamedFilters(context.searchParams, name, fieldsForFilters ?? [])
      : [];
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
        pageSize,
        orderBy,
        filters: [...(request.params.filters ?? []), ...dynamicFilters],
      },
    };
  }

  const withTotal = Boolean(definition.query?.pagination?.withTotal);

  // Already fetched (and awaited) above when `query.filters` needed it first
  // - reused here rather than fetched twice. Otherwise, `exposeFields` alone
  // still fetches it, just in parallel with the request below.
  let fieldsPromise = Promise.resolve(fieldsForFilters);
  if (fieldsForFilters === undefined && definition.exposeFields && doctype) {
    fieldsPromise = fetchDoctypeFields(doctype);
  }

  const [rawContext, fields] = await Promise.all([
    executeRequest(request, { orFilters, paginate, withTotal }),
    fieldsPromise,
  ]);
  const transformed = applyTransforms(
    rawContext,
    substituteTransformSentinels(definition.transform, period),
  );
  const resolved = toResolvedValue(transformed);
  return fields ? { ...resolved, fields } : resolved;
}

async function resolveNamedData(
  data: Record<string, DataDefinition> | undefined,
  context: DataSourceContext,
): Promise<[string, unknown][]> {
  return Promise.all(
    Object.entries(data ?? {}).map(
      async ([name, definition]) =>
        [
          `${PAGE_DATA_PREFIX}${name}`,
          await resolveDataDefinition(name, definition, context),
        ] as const,
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
  for (const child of definition.children)
    collectStringSources(child, collected);

  const [registeredEntries, namedEntries] = await Promise.all([
    Promise.all(
      [...collected].map(
        async (id) => [id, await getDataSource(id)?.resolve(context)] as const,
      ),
    ),
    resolveNamedData(definition.data, context),
  ]);

  return Object.fromEntries([...registeredEntries, ...namedEntries]);
}
