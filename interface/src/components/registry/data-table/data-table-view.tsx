"use client";

import * as React from "react";

import { buildColumnDefs, buildFilterFields, type ColumnSpec } from "./column-spec";
import { OsDataTable } from "./data-table";

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
  rowId?: string;
  /** Org-default currency for any `format: "currency"` column - applied
   * uniformly to every row (a disclosed simplification: a genuine per-row
   * currency override, the way `/os`'s original tables had, isn't part of
   * this declarative contract). */
  currency?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  columnVisibility?: boolean;
  compulsoryColumns?: string[];
  minVisibleColumns?: number;
  selectable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  /** Server/generic-source pagination metadata - a `data`-bound prop (e.g.
   * `{ ref: "customers", path: "pagination" }`), resolved from the same
   * source `rows` came from. See `docs/UI_RUNTIME.md`'s "Paginated Data
   * Sources" and `OsDataTable`'s own doc comment. */
  pagination?: { page: number; pageSize: number; hasMore: boolean };
  /** The URL search param this table's page reads/writes when `pagination`
   * is set (e.g. `"customers_page"`) - a plain `props` value, not resolved
   * from any source. */
  pageParam?: string;
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
  rowId,
  currency,
  searchable,
  searchPlaceholder,
  columnVisibility,
  compulsoryColumns,
  minVisibleColumns,
  selectable,
  paginated,
  pageSize,
  pagination,
  pageParam,
  emptyMessage,
}: OsDataTableViewProps) {
  const columnDefs = React.useMemo(() => buildColumnDefs(columns, currency), [columns, currency]);
  const filterFields = React.useMemo(() => buildFilterFields(columns), [columns]);
  const filterable = filterFields.length > 0;

  return (
    <OsDataTable
      title={title}
      subtitle={subtitle}
      columns={columnDefs}
      data={rows ?? []}
      getRowId={rowId ? (row) => String((row as Record<string, unknown>)[rowId]) : undefined}
      searchable={searchable}
      searchPlaceholder={searchPlaceholder}
      filterable={filterable}
      filterFields={filterFields}
      columnVisibility={columnVisibility}
      compulsoryColumns={compulsoryColumns}
      minVisibleColumns={minVisibleColumns}
      selectable={selectable}
      paginated={paginated}
      pageSize={pageSize}
      pagination={pagination}
      pageParam={pageParam}
      emptyMessage={emptyMessage}
    />
  );
}
