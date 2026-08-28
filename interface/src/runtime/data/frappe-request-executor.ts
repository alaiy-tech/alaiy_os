import { frappeFetch } from "@/lib/frappe/server";
import type { DataRequest, FrappeFilter } from "@/types/runtime/data-request";

import type { TransformContext } from "./transform-engine";

/** Turns one `[field, operator, value]`-shaped filter list into Frappe's own
 * REST filter tuple shape. Shared by `list`/`count` operations so the
 * mapping can't drift between them. */
function toFrappeFilterTuples(filters: FrappeFilter[] | undefined): Array<[string, string, FrappeFilter["value"]]> {
  return (filters ?? []).map((f) => [f.field, f.operator, f.value]);
}

/** Pure request-path builder for a `list` operation, exported separately so
 * it's unit-testable without mocking `fetch`. Matches the standard Frappe
 * REST doctype list shape (`/api/resource/<Doctype>`), the same one
 * `lib/frappe/logs.ts`'s fetchers already use. `paginate` controls whether
 * the over-fetch-one-extra-row `hasMore` trick applies - only meaningful
 * when this definition's `query.pagination` is declared; otherwise `pageSize`
 * is just a fetch cap for aggregation, and no extra row is requested. */
export function buildListRequestPath(
  request: Extract<DataRequest, { operation: "list" }>,
  options: { orFilters?: FrappeFilter[]; paginate: boolean },
): string {
  const { doctype, params } = request;
  const page = params.page ?? 1;
  const pageSize = params.pageSize;

  const fields = Array.from(new Set(["name", ...params.fields]));

  const query = new URLSearchParams();
  query.set("fields", JSON.stringify(fields));
  if (params.filters?.length) query.set("filters", JSON.stringify(toFrappeFilterTuples(params.filters)));
  if (options.orFilters?.length) query.set("or_filters", JSON.stringify(toFrappeFilterTuples(options.orFilters)));
  if (params.orderBy) query.set("order_by", params.orderBy);
  if (options.paginate) query.set("limit_start", String((page - 1) * pageSize));
  query.set("limit_page_length", String(options.paginate ? pageSize + 1 : pageSize));

  return `/api/resource/${encodeURIComponent(doctype)}?${query.toString()}`;
}

function buildCountRequestPath(request: Extract<DataRequest, { operation: "count" }>): string {
  const query = new URLSearchParams();
  query.set("doctype", request.doctype);
  if (request.params?.filters?.length)
    query.set("filters", JSON.stringify(toFrappeFilterTuples(request.params.filters)));
  return `/api/method/frappe.client.get_count?${query.toString()}`;
}

function buildMethodRequestPath(request: Extract<DataRequest, { operation: "method" }>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(request.args ?? {})) {
    if (value !== null && value !== undefined) query.set(key, String(value));
  }
  const serialised = query.toString();
  return `/api/method/${request.method}${serialised ? `?${serialised}` : ""}`;
}

/**
 * Executes one `DataRequest` against the existing Frappe BFF (`frappeFetch` -
 * no second HTTP client, same cookie-forwarded session Frappe stays
 * authoritative over) and returns the seed `TransformContext` a
 * `transform` pipeline runs over. Never throws - a failed request degrades
 * to an empty/zero result, matching every other server-side fetcher's
 * silent-null convention in this codebase.
 */
export async function executeRequest(
  request: DataRequest,
  options: { orFilters?: FrappeFilter[]; paginate: boolean },
): Promise<TransformContext> {
  if (request.operation === "list") {
    const path = buildListRequestPath(request, options);
    const res = await frappeFetch(path);
    if (!res.ok) {
      return options.paginate
        ? {
            rows: [],
            computed: {
              pagination: { page: request.params.page ?? 1, pageSize: request.params.pageSize, hasMore: false },
            },
          }
        : { rows: [], computed: {} };
    }
    const body = (await res.json()) as { data?: Record<string, unknown>[] };
    const rows = body.data ?? [];
    if (!options.paginate) return { rows, computed: {} };

    const hasMore = rows.length > request.params.pageSize;
    return {
      rows: hasMore ? rows.slice(0, request.params.pageSize) : rows,
      computed: { pagination: { page: request.params.page ?? 1, pageSize: request.params.pageSize, hasMore } },
    };
  }

  if (request.operation === "count") {
    const res = await frappeFetch(buildCountRequestPath(request));
    if (!res.ok) return { computed: { count: 0 } };
    const body = (await res.json()) as { message?: number };
    return { computed: { count: body.message ?? 0 } };
  }

  // "method"
  const res = await frappeFetch(buildMethodRequestPath(request));
  if (!res.ok) return { computed: {} };
  const body = (await res.json()) as { message?: unknown };
  const message = body.message;
  return {
    computed:
      message !== null && typeof message === "object"
        ? { ...(message as Record<string, unknown>) }
        : { value: message },
  };
}
