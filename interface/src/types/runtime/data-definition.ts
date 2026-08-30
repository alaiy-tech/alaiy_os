import type { DataRequest } from "./data-request";
import type { TransformStep } from "./data-transform";

/** Which parts of a `list`-operation `request` are URL-driven, namespaced by
 * this entry's name in `page.data` (`` `${name}_page` ``/`_sort`/`_search`/
 * `_filter_<field>` - the same convention `frappe-list` established,
 * generalized to any request). Only meaningful for `operation: "list"` -
 * a `count`/`method` request has no `params.filters`/`orderBy`/pagination
 * to substitute into, so it simply has no `query`. */
export type QueryBinding = {
  /** `withTotal` fetches a real row count (a second Frappe request) so the
   * table can render numbered page links instead of just Prev/Next off
   * `hasMore` - see `runtime/data/frappe-request-executor.ts`'s
   * `buildTotalCountRequestPath`. Costs one extra request per resolve. */
  pagination?: { pageSize: number; withTotal?: boolean };
  sort?: { allowedFields: string[] };
  search?: { fields: string[] };
  /** Opts into per-field server-side filtering, one active filter per field,
   * read from `` `${name}_filter_<field>` `` (value) and
   * `` `${name}_filter_<field>_op` `` (operator, defaults to `"="`) - see
   * `runtime/data/resolver.ts`'s `readNamedFilters`. Unlike `sort`/`search`,
   * there is no separate field allowlist here: `exposeFields: true` (see
   * below - required whenever `filters` is true) already fetches this
   * request's doctype's own field list, and *that* is the safety boundary a
   * URL-supplied field name is checked against - both field and operator are
   * request-driven, since a table's own filter popover now lets a user pick
   * any doctype field and any (whitelisted) operator, not just one
   * author-fixed operator per author-declared field. */
  filters?: boolean;
};

/** A page-level named data definition (`UIPageDefinition.data[name]`):
 * where to get data, what to ask for, which parts of that are request-driven,
 * and how to reshape the result before a component binds to it. Replaces
 * the old per-source-type configs (`FrappeListSourceConfig`/
 * `FrappeCountSourceConfig`) with one shape that composes via `transform`
 * instead of a growing catalogue of `type`s. */
export type DataDefinition = {
  request: DataRequest;
  query?: QueryBinding;
  transform?: TransformStep[];
  /** When true, the resolver also fetches the request's doctype's own field
   * metadata (the same whitelisted `alaiy_os.api.list_view.get_doctype_fields`
   * method `hooks/use-doctype-meta.ts` calls client-side, via
   * `runtime/data/fetch-doctype-fields.ts` server-side instead) and exposes
   * it as `computed.fields` - the pool `os-data-table`'s filter/column
   * popovers draw from (every field the doctype has), independent of which
   * columns are authored to show by default. One extra request, run in
   * parallel with the main one; only meaningful for `list`/`count`
   * operations (the only ones with a `doctype`). */
  exposeFields?: boolean;
};
