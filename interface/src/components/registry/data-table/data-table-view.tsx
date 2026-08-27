"use client";

import * as React from "react";

import type { DocFieldMeta } from "@/components/derived/list/types";

import {
  buildColumnDefs,
  buildCompulsoryColumns,
  buildExtraColumnDefs,
  type ColumnSpec,
} from "./column-spec";
import { OsDataTable } from "./data-table";
import type { RowActionGroup } from "./row-actions";
import type { BulkActionGroup } from "./selection-actions";

export type OsDataTableViewProps = {
  title?: string;
  subtitle?: string;
  /** The declarative column spec - plain JSON, safe as a `props` value (see
   * `column-spec.ts`'s doc comment for why this matters). */
  columns: ColumnSpec[];
  /** The resolved rows - the one thing this component binds through the
   * Data Source Registry rather than taking as static `props`. Typed as
   * possibly `undefined` on purpose: an unresolved/unregistered data source
   * degrades to `undefined` (see `resolve-data-source.ts`), not an empty
   * array - a JSON page whose `source` id has a typo should render an empty
   * table, not crash. */
  rows: Record<string, unknown>[] | undefined;
  /** The doctype's own field metadata - a `data`-bound prop (e.g. `{ ref:
   * "orders", path: "fields" }`), resolved only when that named
   * entry's `DataDefinition.exposeFields` is `true` (see
   * `runtime/data/resolver.ts`). This, not `columns`, is the pool the
   * filter and column popovers draw from - `columns` is just the
   * default/initial visible set. Omitted (the source didn't opt in) means
   * the popovers only ever offer what's in `columns`. */
  fields?: DocFieldMeta[];
  /** Doctype fields that never show up in either popover, even though
   * `fields` includes them - e.g. one already folded into another column's
   * cell. */
  excludedFields?: string[];
  rowId?: string;
  /** Org-default currency for any `format: "currency"` column - applied
   * uniformly to every row (a disclosed simplification: a genuine per-row
   * currency override, the way `/os`'s original tables had, isn't part of
   * this declarative contract). */
  currency?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Mirrors `OsDataTable`'s own `searchParam` - see its doc comment. */
  searchParam?: string;
  /** Mirrors `OsDataTable`'s own `filterParam` - see its doc comment. */
  filterParam?: string;
  columnVisibility?: boolean;
  minVisibleColumns?: number;
  selectable?: boolean;
  /** Declarative row-actions ("3 dots") column - see `row-actions.tsx`'s doc
   * comment for the closed navigate/edit/delete vocabulary. Omitted means no
   * actions column at all. */
  actions?: RowActionGroup[];
  /** Declarative bulk "Actions (N)" button - see `selection-actions.tsx`'s
   * doc comment for the closed edit/delete vocabulary. Required (by
   * `component-props-schema.ts`'s `superRefine`) whenever `selectable` is
   * true. */
  selectionActions?: BulkActionGroup[];
  paginated?: boolean;
  pageSize?: number;
  /** Server/generic-source pagination metadata - a `data`-bound prop (e.g.
   * `{ ref: "customers", path: "pagination" }`), resolved from the same
   * source `rows` came from. See `docs/UI_RUNTIME.md`'s "Paginated Data
   * Sources" and `OsDataTable`'s own doc comment. */
  pagination?: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    total?: number;
  };
  /** The URL search param this table's page reads/writes when `pagination`
   * is set (e.g. `"customers_page"`) - a plain `props` value, not resolved
   * from any source. */
  pageParam?: string;
  /** Mirrors `OsDataTable`'s own `pageSizeParam` - see its doc comment. */
  pageSizeParam?: string;
  /** The current effective sort - a `data`-bound prop (e.g. `{ ref:
   * "suppliers", path: "orderBy" }`), resolved from the same source `rows`
   * came from. See `docs/UI_RUNTIME.md`'s "Generic List Query State". */
  sort?: string;
  /** The URL search param this table's sort reads/writes when `sort` is set
   * (e.g. `"suppliers_sort"`) - a plain `props` value, not resolved from any
   * source. */
  sortParam?: string;
  emptyMessage?: string;
};

/**
 * The `os-data-table` registry entry - the only thing a UI Definition ever
 * references. Translates the declarative `columns` spec into real TanStack
 * `ColumnDef`s (via `buildColumnDefs`) *inside* this client component, then
 * renders the underlying `OsDataTable` primitive - the same component
 * `column-spec.ts`'s module doc explains the RSC-serialization reasoning
 * for. This is what makes `os-data-table` fully generic again: nothing
 * feature-specific is needed anywhere, because both `columns` (plain spec)
 * and `rows` (plain data) are JSON-safe values a Server Component can hand
 * down without ever passing a function across the boundary.
 */
export function OsDataTableView({
  title,
  subtitle,
  columns,
  rows,
  fields,
  excludedFields,
  rowId,
  currency,
  searchable,
  searchPlaceholder,
  searchParam,
  filterParam,
  columnVisibility,
  minVisibleColumns,
  selectable,
  actions,
  selectionActions,
  paginated,
  pageSize,
  pagination,
  pageParam,
  pageSizeParam,
  sort,
  sortParam,
  emptyMessage,
}: OsDataTableViewProps) {
  const columnDefs = React.useMemo(
    () => [
      ...buildColumnDefs(columns, currency),
      ...buildExtraColumnDefs(columns, fields ?? [], excludedFields),
    ],
    [columns, currency, fields, excludedFields],
  );
  const compulsoryColumns = React.useMemo(
    () => buildCompulsoryColumns(columns),
    [columns],
  );
  // Only the authored `columns` start visible - the doctype fields folded
  // in by `buildExtraColumnDefs` are part of `manageableColumnIds` too (so
  // the "Add Fields" picker can offer them), but must start unchecked until
  // the user actually adds one. Without this, `OsDataTable`'s own default
  // (`defaultColumnOrder ?? manageableColumnIds`) would show every doctype
  // field as already visible.
  const defaultColumnOrder = React.useMemo(
    () => columns.map((column) => column.field),
    [columns],
  );
  const filterFields = React.useMemo(() => {
    const excluded = new Set(excludedFields ?? []);
    return (fields ?? []).filter((field) => !excluded.has(field.fieldname));
  }, [fields, excludedFields]);
  const filterable = filterFields.length > 0;

  return (
    <OsDataTable
      title={title}
      subtitle={subtitle}
      columns={columnDefs}
      data={rows ?? []}
      getRowId={
        rowId
          ? (row) => String((row as Record<string, unknown>)[rowId])
          : undefined
      }
      searchable={searchable}
      searchPlaceholder={searchPlaceholder}
      searchParam={searchParam}
      filterable={filterable}
      filterFields={filterFields}
      filterParam={filterParam}
      columnVisibility={columnVisibility}
      defaultColumnOrder={defaultColumnOrder}
      compulsoryColumns={compulsoryColumns}
      minVisibleColumns={minVisibleColumns}
      selectable={selectable}
      actions={actions}
      selectionActions={selectionActions}
      paginated={paginated}
      pageSize={pageSize}
      pagination={pagination}
      pageParam={pageParam}
      pageSizeParam={pageSizeParam}
      sort={sort}
      sortParam={sortParam}
      emptyMessage={emptyMessage}
    />
  );
}
