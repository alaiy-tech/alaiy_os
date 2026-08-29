import type { DataRequest, FrappeFilterOperator } from "./data-request";
import type { TransformStep } from "./data-transform";

/** Which parts of a `list`-operation `request` are URL-driven, namespaced by
 * this entry's name in `page.data` (`` `${name}_page` ``/`_sort`/`_search`/
 * `_filter_<field>` - the same convention `frappe-list` established,
 * generalized to any request). Only meaningful for `operation: "list"` -
 * a `count`/`method` request has no `params.filters`/`orderBy`/pagination
 * to substitute into, so it simply has no `query`. */
export type QueryBinding = {
  pagination?: { pageSize: number };
  sort?: { allowedFields: string[] };
  search?: { fields: string[] };
  filters?: { field: string; operator: FrappeFilterOperator }[];
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
};
