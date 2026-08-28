/** What a data definition asks Frappe for. One `type` (`"frappe"` - the only
 * backend this app has) and a fixed set of `operation`s, rather than a
 * growing catalogue of source types (`frappe-list`, `frappe-count`,
 * `frappe-aggregate`, ...) - a new need is a new `operation` or a new
 * `transform` step (`data-transform.ts`), not a new top-level type. */

export type FrappeFilterOperator = "=" | "!=" | "like" | "not like" | ">" | "<" | ">=" | "<=" | "in" | "not in";

export type FrappeFilter = {
  field: string;
  operator: FrappeFilterOperator;
  /** May also be a sentinel - `"$period"`/`"$period_start"` - substituted
   * by the resolver from the global `?period=` value before the request is
   * sent. See `runtime/data/resolver.ts`'s `substituteSentinels`. */
  value: string | number | (string | number)[];
};

export type FrappeListRequest = {
  type: "frappe";
  operation: "list";
  doctype: string;
  params: {
    fields: string[];
    filters?: FrappeFilter[];
    orderBy?: string;
    /** How many rows to fetch. Only becomes real UI pagination (with
     * `hasMore` via over-fetch) when this definition's `query.pagination`
     * is also set - absent, this is just a fetch cap for aggregation. */
    pageSize: number;
    page?: number;
  };
};

export type FrappeCountRequest = {
  type: "frappe";
  operation: "count";
  doctype: string;
  params?: { filters?: FrappeFilter[] };
};

export type FrappeMethodRequest = {
  type: "frappe";
  operation: "method";
  /** A whitelisted Frappe method path, e.g. `"alaiy_os.api.dashboard_stats.get_dashboard_overview"` -
   * for complex, already-correct business logic that doesn't belong as raw
   * doctype math (see docs/UI_RUNTIME.md's "domain-specific sources"). */
  method: string;
  args?: Record<string, string | number | boolean | null>;
};

export type DataRequest = FrappeListRequest | FrappeCountRequest | FrappeMethodRequest;
