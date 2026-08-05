"use client";
"use no memo";

import * as React from "react";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { Cog, Search, X } from "lucide-react";

import type { ColumnPrefs, DocFieldMeta, FilterRow } from "@/components/derived/list/types";
import { type ColumnField, ColumnSettingsPopover } from "@/components/derived/popover/column-settings-popover";
import { FilterPopover } from "@/components/derived/popover/filter-popover";
import { PaginationFooter } from "@/components/layout/pagination-footer";
import { Button } from "@/components/primitive/button";
import { ButtonGroup } from "@/components/primitive/button-group";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/primitive/card";
import { Checkbox } from "@/components/primitive/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/primitive/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/primitive/table";

import { applyFilterRows } from "./apply-filters";
import { usePaginationParam } from "./use-pagination-param";
import { useSortParam } from "./use-sort-param";

export type OsDataTableProps<TData> = {
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;

  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  getRowId?: (row: TData, index: number) => string;

  searchable?: boolean;
  searchPlaceholder?: string;
  /** Which fields the search box matches against. Every field is checked
   * (stringified) if omitted. */
  searchFields?: (keyof TData)[];

  filterable?: boolean;
  /** Drives the filter builder's field/operator/value UI - required for
   * `filterable` to do anything (a table with no known fields has nothing to
   * offer a filter row). */
  filterFields?: DocFieldMeta[];

  columnVisibility?: boolean;
  /** Which manageable columns show, and in what order, before the user
   * customizes it. Falls back to every non-structural column, in the order
   * `columns` declares them. */
  defaultColumnOrder?: string[];
  /** Column ids (from your own `columns`) that are always visible and never
   * offered in the column picker - e.g. a trailing `actions` menu. The
   * `select` checkbox column `selectable` generates is already structural
   * automatically; you don't need to list it here. Assumed to run as a
   * leading and/or trailing block (matching every real table this component
   * replaces); interleaving a structural column in the middle isn't
   * supported. */
  structuralColumnIds?: string[];
  compulsoryColumns?: string[];
  minVisibleColumns?: number;

  selectable?: boolean;

  paginated?: boolean;
  pageSize?: number;

  /** Server/generic-source pagination metadata - when present, this table
   * pages via URL state (`pageParam`) instead of TanStack's client-side row
   * slicing, and `data` is expected to already be just the current page's
   * rows (no re-slicing happens in this mode - see `docs/UI_RUNTIME.md`'s
   * "Paginated Data Sources"). `hasMore`, not a true total, drives
   * Next/Previous - there's no "of N pages" total in this mode. */
  pagination?: { page: number; pageSize: number; hasMore: boolean };
  /** The URL search param this table's page number reads/writes when
   * `pagination` is set (e.g. `"customers_page"`) - a source needs an
   * explicit, stable name to be paginated interactively; omitted,
   * Next/Previous render disabled rather than silently doing nothing. */
  pageParam?: string;

  /** The current effective sort - e.g. `"supplier_name asc"`, the same
   * literal format `frappe-list`'s own static `orderBy` uses. When present,
   * this table's sortable column headers become URL-driven (`sortParam`)
   * instead of local TanStack state, and `data` is expected to already be
   * sorted server-side (no client re-sort happens in this mode - see
   * `docs/UI_RUNTIME.md`'s "Generic List Query State"). */
  sort?: string;
  /** The URL search param this table's sort reads/writes when `sort` is set
   * (e.g. `"suppliers_sort"`) - mirrors `pageParam`: omitted, clicking a
   * sortable header does nothing rather than silently sorting only the
   * current page. */
  sortParam?: string;

  emptyMessage?: string;
};

function applySearch<TData>(data: TData[], query: string, fields?: (keyof TData)[]): TData[] {
  if (!query) return data;
  const needle = query.toLowerCase();

  return data.filter((row) => {
    const record = row as Record<string, unknown>;
    const keys = fields ?? (Object.keys(record) as (keyof TData)[]);
    return keys.some((key) =>
      String(record[key as string] ?? "")
        .toLowerCase()
        .includes(needle),
    );
  });
}

function columnId(column: ColumnDef<unknown, unknown>): string | undefined {
  return column.id ?? (column as { accessorKey?: string }).accessorKey;
}

function columnFieldsFrom<TData>(columns: ColumnDef<TData, unknown>[], structuralIds: Set<string>): ColumnField[] {
  return columns
    .map((column) => {
      const id = columnId(column as ColumnDef<unknown, unknown>);
      if (!id || structuralIds.has(id)) return null;
      const label = typeof column.header === "string" ? column.header : id;
      return { fieldname: id, label };
    })
    .filter((field): field is ColumnField => field !== null);
}

/** Structural columns are assumed to run as a leading and/or trailing block
 * (a `select` checkbox first, an `actions` menu last) - real usage here never
 * interleaves one in the middle. */
function splitStructural(allIds: string[], structuralIds: Set<string>): { leading: string[]; trailing: string[] } {
  let start = 0;
  while (start < allIds.length && structuralIds.has(allIds[start])) start++;
  let end = allIds.length;
  while (end > start && structuralIds.has(allIds[end - 1])) end--;
  return { leading: allIds.slice(0, start), trailing: allIds.slice(end) };
}

/**
 * The `os-data-table` registry entry, and the shared table implementation
 * this app should reuse anywhere it needs one - built on the same v8
 * TanStack APIs (`useReactTable`, `getCoreRowModel`/`getSortedRowModel`/
 * `getPaginationRowModel`, `flexRender`) already used by every other table in
 * this codebase, plus the existing `FilterPopover`/`ColumnSettingsPopover`/
 * `PaginationFooter` - not a new table implementation, not a version
 * upgrade. Every feature (search/filter/columns/selection/pagination) is a
 * boolean prop; the caller supplies `columns`/`data` the same way any
 * `useReactTable` caller would.
 */
export function OsDataTable<TData>({
  title,
  subtitle,
  headerActions,
  data,
  columns,
  getRowId,
  searchable = false,
  searchPlaceholder = "Search...",
  searchFields,
  filterable = false,
  filterFields = [],
  columnVisibility = false,
  defaultColumnOrder,
  structuralColumnIds = [],
  compulsoryColumns = [],
  minVisibleColumns = 1,
  selectable = false,
  paginated = true,
  pageSize = 10,
  pagination,
  pageParam,
  sort,
  sortParam,
  emptyMessage = "No results.",
}: OsDataTableProps<TData>) {
  const manualPagination = pagination !== undefined;
  const manualSorting = sort !== undefined;

  // Dev-only, loud rather than silently inert: a paginated/sorted source
  // with no stable name to write URL state against is a real authoring
  // mistake, not a no-op.
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (manualPagination && !pageParam) {
      console.warn(
        "OsDataTable: `pagination` was provided without a `pageParam` - Next/Previous will render disabled. Give this table's data source an explicit name (a page-level `data` entry) to make it paginable.",
      );
    }
    if (manualSorting && !sortParam) {
      console.warn(
        "OsDataTable: `sort` was provided without a `sortParam` - clicking a sortable header will do nothing. Give this table's data source an explicit name (a page-level `data` entry) to make it sortable.",
      );
    }
  }, [manualPagination, pageParam, manualSorting, sortParam]);

  // `selectable` gets a checkbox column for free - the caller only supplies
  // its own structural columns (e.g. a trailing "actions" menu), not a select
  // column, so "just set a boolean" holds for the single most common case.
  const effectiveColumns = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!selectable) return columns;
    const selectColumn: ColumnDef<TData, unknown> = {
      id: "select",
      header: ({ table }) => {
        let checked: boolean | "indeterminate" = false;
        if (table.getIsAllPageRowsSelected()) checked = true;
        else if (table.getIsSomePageRowsSelected()) checked = "indeterminate";

        return (
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all rows"
          />
        );
      },
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };
    return [selectColumn, ...columns];
  }, [selectable, columns]);

  const effectiveStructuralColumnIds = React.useMemo(
    () => (selectable ? ["select", ...structuralColumnIds] : structuralColumnIds),
    [selectable, structuralColumnIds],
  );

  const structuralIds = React.useMemo(() => new Set(effectiveStructuralColumnIds), [effectiveStructuralColumnIds]);
  const allColumnIds = React.useMemo(
    () =>
      effectiveColumns.map((c) => columnId(c as ColumnDef<unknown, unknown>)).filter((id): id is string => Boolean(id)),
    [effectiveColumns],
  );
  const manageableColumnIds = React.useMemo(
    () => allColumnIds.filter((id) => !structuralIds.has(id)),
    [allColumnIds, structuralIds],
  );
  const columnFields = React.useMemo(
    () => columnFieldsFrom(effectiveColumns, structuralIds),
    [effectiveColumns, structuralIds],
  );

  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  React.useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const [filterRows, setFilterRows] = React.useState<FilterRow[]>([]);
  const [columnsOpen, setColumnsOpen] = React.useState(false);
  const [columnPrefs, setColumnPrefs] = React.useState<ColumnPrefs>({
    columnOrder: defaultColumnOrder ?? manageableColumnIds,
  });

  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [clientPagination, setClientPagination] = React.useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: paginated ? pageSize : Number.MAX_SAFE_INTEGER,
  }));

  // Always called (Rules of Hooks) - inert when `manualPagination` is
  // false, since nothing reads `urlPage`/`setUrlPage` in that branch.
  const { page: urlPage, setPage: setUrlPage } = usePaginationParam(pageParam ?? "", pagination?.page ?? 1);

  const effectivePagination: PaginationState = manualPagination
    ? { pageIndex: urlPage - 1, pageSize: pagination.pageSize }
    : clientPagination;

  function handlePaginationChange(updater: React.SetStateAction<PaginationState>) {
    if (!manualPagination) {
      setClientPagination(updater);
      return;
    }
    if (!pageParam) return; // no stable identity to write a page number to
    const next = typeof updater === "function" ? updater(effectivePagination) : updater;
    setUrlPage(next.pageIndex + 1);
  }

  // Always called (Rules of Hooks) - inert when `manualSorting` is false.
  // Resetting `pageParam` (if any) alongside a sort write, not just a page
  // write, is what satisfies "changing sort resets the relevant page"
  // without OsFilterBar's involvement - see docs/UI_RUNTIME.md.
  const { value: urlSort, setValue: setUrlSort } = useSortParam(sortParam ?? "", pageParam ? [pageParam] : []);

  const effectiveSorting: SortingState = React.useMemo(() => {
    if (!manualSorting) return [];
    const value = urlSort ?? sort;
    if (!value) return [];
    const [field, direction] = value.trim().split(/\s+/);
    return field ? [{ id: field, desc: direction?.toLowerCase() === "desc" }] : [];
  }, [manualSorting, urlSort, sort]);

  function handleSortingChange(updater: React.SetStateAction<SortingState>) {
    if (!manualSorting) {
      setSorting(updater);
      return;
    }
    if (!sortParam) return; // no stable identity to write a sort to
    const next = typeof updater === "function" ? updater(effectiveSorting) : updater;
    const entry = next[0];
    setUrlSort(entry ? `${entry.id} ${entry.desc ? "desc" : "asc"}` : null);
  }

  const filteredData = React.useMemo(() => {
    let result = data;
    if (searchable) result = applySearch(result, search, searchFields);
    if (filterable) result = applyFilterRows(result, filterRows, filterFields);
    return result;
  }, [data, searchable, search, searchFields, filterable, filterRows, filterFields]);

  const columnVisibilityState = React.useMemo<VisibilityState>(() => {
    if (!columnVisibility) return {};
    const visible = new Set(columnPrefs.columnOrder);
    const state: VisibilityState = {};
    for (const id of manageableColumnIds) state[id] = visible.has(id);
    return state;
  }, [columnVisibility, columnPrefs, manageableColumnIds]);

  const columnOrderState = React.useMemo<string[]>(() => {
    if (!columnVisibility) return [];
    const { leading, trailing } = splitStructural(allColumnIds, structuralIds);
    const middle = columnPrefs.columnOrder.filter((id) => manageableColumnIds.includes(id));
    const remaining = manageableColumnIds.filter((id) => !middle.includes(id));
    return [...leading, ...middle, ...remaining, ...trailing];
  }, [columnVisibility, allColumnIds, structuralIds, columnPrefs, manageableColumnIds]);

  const table = useReactTable({
    data: filteredData,
    columns: effectiveColumns,
    state: {
      sorting: manualSorting ? effectiveSorting : sorting,
      pagination: effectivePagination,
      rowSelection,
      columnVisibility: columnVisibilityState,
      columnOrder: columnOrderState,
    },
    getRowId,
    enableRowSelection: selectable,
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
    manualPagination,
    manualSorting,
    pageCount: manualPagination ? -1 : undefined,
    getCoreRowModel: getCoreRowModel(),
    // Not wired at all in manual-sort mode: `data` is already sorted
    // server-side - re-sorting client-side would be redundant at best
    // (a stable no-op) and wrong at worst (TanStack's default comparator
    // doesn't know a column is numeric/date), same reasoning as skipping
    // `getPaginationRowModel` below.
    ...(manualSorting ? {} : { getSortedRowModel: getSortedRowModel() }),
    // Not wired at all in manual mode: `data` is already just the current
    // page's rows (server-resolved), so there's nothing to slice - TanStack's
    // own documented server-pagination pattern. Wiring it anyway would
    // silently re-slice an already-one-page result into an empty "page 2."
    ...(manualPagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
  });

  // Plain boolean/truthiness checks, not "pick the first defined value" - `??`
  // would be wrong here (an empty-string `title` would then never fall
  // through to `subtitle`), so this deliberately isn't `a ?? b ?? c`.
  const hasHeader = [title, subtitle, headerActions].some(Boolean);

  return (
    <Card>
      {hasHeader && (
        <CardHeader>
          {title && <CardTitle className="leading-none">{title}</CardTitle>}
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
          {headerActions && <CardAction>{headerActions}</CardAction>}
        </CardHeader>
      )}

      <CardContent className="flex flex-col gap-4">
        {[searchable, filterable, columnVisibility].some(Boolean) && (
          <div className="flex flex-wrap items-center gap-2">
            {searchable && (
              <InputGroup className="h-7 w-full md:w-64">
                <InputGroupAddon align="inline-start">
                  <Search className="size-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder={searchPlaceholder}
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    setClientPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                />
              </InputGroup>
            )}

            {filterable && (
              <ButtonGroup>
                <FilterPopover
                  availableFields={filterFields}
                  value={filterRows}
                  onApply={(rows) => {
                    setFilterRows(rows);
                    setClientPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filterRows.length === 0}
                  onClick={() => setFilterRows([])}
                  aria-label="Clear all filters"
                >
                  <X />
                </Button>
              </ButtonGroup>
            )}

            {columnVisibility && (
              <ColumnSettingsPopover
                open={columnsOpen}
                onOpenChange={setColumnsOpen}
                trigger={
                  <Button variant="outline" size="sm">
                    <Cog /> Columns
                  </Button>
                }
                availableFields={columnFields}
                value={columnPrefs}
                minVisibleColumns={minVisibleColumns}
                compulsoryFields={compulsoryColumns}
                onSave={(prefs) => {
                  if (prefs.columnOrder.length < minVisibleColumns) return;
                  setColumnPrefs(prefs);
                }}
              />
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {paginated && (
          <PaginationFooter
            table={table}
            totalCount={filteredData.length}
            itemLabel="rows"
            external={
              manualPagination
                ? {
                    hasMore: pagination.hasMore,
                    onNext: () => setUrlPage(urlPage + 1),
                    onPrevious: () => setUrlPage(urlPage - 1),
                    disabled: !pageParam,
                  }
                : undefined
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
