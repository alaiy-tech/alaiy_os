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
  type Table as TableType,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { Cog, Search, X } from "lucide-react";

import type {
  ColumnPrefs,
  DocFieldMeta,
  FilterRow,
} from "@/components/derived/list/types";
import {
  type ColumnField,
  ColumnSettingsPopover,
} from "@/components/derived/popover/column-settings-popover";
import { FilterPopover } from "@/components/derived/popover/filter-popover";
import { Button } from "@/components/primitive/button";
import { ButtonGroup } from "@/components/primitive/button-group";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/primitive/card";
import { Checkbox } from "@/components/primitive/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "@/components/primitive/empty";
import { Input } from "@/components/primitive/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/primitive/input-group";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/primitive/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/primitive/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/primitive/table";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/constants/list";
import { getPageNumbers } from "@/utils/get-page-numbers";

import { applyFilterRows } from "./apply-filters";
import { buildActionsColumn, type RowActionGroup } from "./row-actions";
import {
  type BulkActionGroup,
  SelectionActionsMenu,
} from "./selection-actions";
import { usePaginationParam } from "./use-pagination-param";
import { useUrlParam } from "./use-url-param";

export type OsDataTableProps<TData extends Record<string, unknown>> = {
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;

  /** Declarative row-actions ("3 dots") column - one `DropdownMenuGroup` per
   * entry (separated, never labelled), rendered as the table's trailing
   * column. Omitted means no actions column at all. See
   * `row-actions.tsx`'s doc comment for the closed action vocabulary. */
  actions?: RowActionGroup[];
  /** Identifies a row in the edit/delete placeholder dialog's title -
   * defaults to `getRowId`'s own value (falling back to a plain `name`
   * field read) when omitted. Only meaningful alongside `actions`. */
  getActionRowLabel?: (row: TData) => string;

  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  getRowId?: (row: TData, index: number) => string;

  searchable?: boolean;
  searchPlaceholder?: string;
  /** Which fields the search box matches against. Every field is checked
   * (stringified) if omitted. Ignored when `searchParam` is set - a
   * server-driven search has no local rows to scan. */
  searchFields?: (keyof TData)[];
  /** The URL search param this table's search box reads/writes when set
   * (e.g. `"orders_search"`) - `data` is then assumed already filtered
   * server-side, and the box no longer scans it locally. Omitted keeps
   * today's local in-memory search. See docs/UI_RUNTIME.md's "Generic List
   * Query State". */
  searchParam?: string;

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
  /** A declarative bulk "Actions (N)" button, right-aligned in the toolbar -
   * rendered only once at least one row is checkbox-selected. See
   * `selection-actions.tsx`'s doc comment for the closed edit/delete
   * vocabulary. A table with `selectable` enabled should always supply
   * this - see `component-props-schema.ts`'s `superRefine` for the JSON-page
   * side of that rule. */
  selectionActions?: BulkActionGroup[];

  paginated?: boolean;
  pageSize?: number;

  /** Server/generic-source pagination metadata - when present, this table
   * pages via URL state (`pageParam`) instead of TanStack's client-side row
   * slicing, and `data` is expected to already be just the current page's
   * rows (no re-slicing happens in this mode - see `docs/UI_RUNTIME.md`'s
   * "Paginated Data Sources"). `hasMore`, not a true total, drives
   * Next/Previous - there's no "of N pages" total in this mode. */
  pagination?: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    total?: number;
  };
  /** The URL search param this table's page number reads/writes when
   * `pagination` is set (e.g. `"customers_page"`) - a source needs an
   * explicit, stable name to be paginated interactively; omitted,
   * Next/Previous render disabled rather than silently doing nothing. */
  pageParam?: string;
  /** The URL search param this table's per-page size reads/writes when set -
   * only meaningful alongside `pagination`/`pageParam`. Omitted means no
   * per-page selector renders (Next/Previous still work off the static
   * `pageSize` the source was configured with). */
  pageSizeParam?: string;

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

function applySearch<TData>(
  data: TData[],
  query: string,
  fields?: (keyof TData)[],
): TData[] {
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

function columnFieldsFrom<TData>(
  columns: ColumnDef<TData, unknown>[],
  structuralIds: Set<string>,
): ColumnField[] {
  return columns
    .map((column) => {
      const id = columnId(column as ColumnDef<unknown, unknown>);
      if (!id || structuralIds.has(id)) return null;
      // Every real header here renders as JSX (for alignment), so a plain
      // string header is rare - `meta.label` (set by `column-spec.tsx`'s
      // builders) is the actual source of truth; falling back to `id` only
      // covers a column built ad hoc outside those helpers.
      const metaLabel = (column.meta as { label?: string } | undefined)?.label;
      const label =
        metaLabel ?? (typeof column.header === "string" ? column.header : id);
      return { fieldname: id, label };
    })
    .filter((field): field is ColumnField => field !== null);
}

/** Structural columns are assumed to run as a leading and/or trailing block
 * (a `select` checkbox first, an `actions` menu last) - real usage here never
 * interleaves one in the middle. */
function splitStructural(
  allIds: string[],
  structuralIds: Set<string>,
): { leading: string[]; trailing: string[] } {
  let start = 0;
  while (start < allIds.length && structuralIds.has(allIds[start])) start++;
  let end = allIds.length;
  while (end > start && structuralIds.has(allIds[end - 1])) end--;
  return { leading: allIds.slice(0, start), trailing: allIds.slice(end) };
}

/** Overrides the default `totalCount`-derived rendering for a table whose
 * rows come from a server/generic data source that only knows `hasMore`, not
 * a true total. `disabled` forces both buttons off regardless of `hasMore`/
 * page - used when the table has no stable identity to page against (no
 * `pageParam`), so paging would have nothing to write to. */
type PaginationExternalState = {
  hasMore: boolean;
  onNext: () => void;
  onPrevious: () => void;
  disabled?: boolean;
  /** The source's actual current page size (already reflects any URL
   * override - see `runtime/data/resolver.ts`'s `readNamedPageSize`), shown
   * as the per-page Select's value. */
  pageSize?: number;
  /** Renders the per-page Select when given - omitted (no `pageSizeParam` on
   * the table) means no selector, matching `onGoToPage`'s own omit-to-hide
   * convention below. */
  onPageSizeChange?: (size: number) => void;
  /** Renders a "Go to page" number input when given - the honest equivalent
   * of numbered page links in this mode when no `total` is known. Ignored
   * when `total` is set, since numbered page links replace it then. */
  onGoToPage?: (page: number) => void;
  /** A real row count (`query.pagination.withTotal`) - when present, renders
   * numbered page links (via `onGoToPage`) and a "Page X of Y · N rows"
   * caption instead of the bare `hasMore`-only "Page X". */
  total?: number;
};

function GoToPageInput({
  disabled,
  onGoToPage,
}: {
  disabled?: boolean;
  onGoToPage: (page: number) => void;
}) {
  const [value, setValue] = React.useState("");

  function commit() {
    const page = Number(value);
    if (Number.isInteger(page) && page > 0) onGoToPage(page);
    setValue("");
  }

  return (
    <div className="flex items-center gap-2 text-muted-foreground text-sm">
      <span>Go to</span>
      <Input
        type="number"
        min={1}
        disabled={disabled}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        onBlur={commit}
        className="h-7 w-16"
        aria-label="Go to page"
      />
    </div>
  );
}

/** Rows-per-page + page count + prev/next, driven by the table's own
 * pagination state - private to `OsDataTable`, the only thing that ever
 * renders one. */
function DataTablePagination<T>({
  table,
  totalCount,
  itemLabel,
  external,
}: {
  table: TableType<T>;
  totalCount?: number;
  itemLabel: string;
  external?: PaginationExternalState;
}) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const currentPage = pageIndex + 1;

  if (external) {
    const effectivePageSize = external.pageSize ?? pageSize;

    // With a real `total`, this behaves like the client-paginated branch
    // below (numbered links, a clamped page count) - only the Next/Previous
    // click handlers and the disabled-with-no-pageParam rule stay
    // `external`-specific. Without one, it falls back to `hasMore`-only
    // Prev/Next plus an optional "Go to page" input.
    if (external.total !== undefined) {
      const pageCount = Math.max(
        Math.ceil(external.total / effectivePageSize),
        1,
      );
      const clampedPage = Math.min(currentPage, pageCount);
      const pageNumbers = getPageNumbers(clampedPage, pageCount);
      const canGoBack = !external.disabled && clampedPage > 1;
      const canGoForward = !external.disabled && clampedPage < pageCount;

      return (
        <div className="flex flex-wrap items-center justify-between gap-2 pr-4">
          <div className="flex items-center gap-4 text-muted-foreground text-sm">
            {external.onPageSizeChange && (
              <div className="flex items-center gap-2">
                <Select
                  value={`${effectivePageSize}`}
                  onValueChange={(value) =>
                    external.onPageSizeChange?.(Number(value))
                  }
                >
                  <SelectTrigger size="sm" className="w-16">
                    <SelectValue placeholder={`${effectivePageSize}`} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    <SelectGroup>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={`${size}`}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
            <span>
              Viewing {clampedPage * pageCount} of {external.total} {itemLabel}
            </span>
          </div>

          <Pagination className="mx-0 w-auto justify-start md:justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text=""
                  className={
                    canGoBack ? undefined : "pointer-events-none opacity-50"
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    if (canGoBack) external.onPrevious();
                  }}
                />
              </PaginationItem>
              {pageNumbers[0] > 1 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              {pageNumbers.map((pageNumber) => (
                <PaginationItem key={`page-${pageNumber}`}>
                  <PaginationLink
                    href="#"
                    isActive={pageNumber === clampedPage}
                    onClick={(event) => {
                      event.preventDefault();
                      if (!external.disabled) external.onGoToPage?.(pageNumber);
                    }}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              ))}
              {pageNumbers[pageNumbers.length - 1] < pageCount && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  text=""
                  className={
                    canGoForward ? undefined : "pointer-events-none opacity-50"
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    if (canGoForward) external.onNext();
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      );
    }

    const canGoBack = !external.disabled && currentPage > 1;
    const canGoForward = !external.disabled && external.hasMore;

    return (
      <div className="flex flex-wrap items-center justify-between gap-2 pr-4">
        <div className="flex items-center gap-4 text-muted-foreground text-sm">
          {external.onPageSizeChange && (
            <div className="flex items-center gap-2">
              <Select
                value={`${effectivePageSize}`}
                onValueChange={(value) =>
                  external.onPageSizeChange?.(Number(value))
                }
              >
                <SelectTrigger size="sm" className="w-16">
                  <SelectValue placeholder={`${effectivePageSize}`} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectGroup>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
          <span>Page {currentPage}</span>
        </div>

        <div className="flex items-center gap-3">
          {external.onGoToPage && (
            <GoToPageInput
              disabled={external.disabled}
              onGoToPage={external.onGoToPage}
            />
          )}

          <Pagination className="mx-0 w-auto justify-start md:justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text=""
                  className={
                    canGoBack ? undefined : "pointer-events-none opacity-50"
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    if (canGoBack) external.onPrevious();
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  text=""
                  className={
                    canGoForward ? undefined : "pointer-events-none opacity-50"
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    if (canGoForward) external.onNext();
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    );
  }

  const pageCount = Math.max(Math.ceil((totalCount ?? 0) / pageSize), 1);
  const clampedPage = Math.min(currentPage, pageCount);
  const pageNumbers = getPageNumbers(clampedPage, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pr-4">
      <div className="flex items-center gap-4 text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger size="sm" className="w-16">
              <SelectValue placeholder={`${pageSize}`} />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectGroup>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <span>
          Page {clampedPage} of {pageCount} · {totalCount} {itemLabel}
        </span>
      </div>

      <Pagination className="mx-0 w-auto justify-start md:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text=""
              className={
                pageIndex === 0 ? "pointer-events-none opacity-50" : undefined
              }
              onClick={(event) => {
                event.preventDefault();
                table.previousPage();
              }}
            />
          </PaginationItem>
          {pageNumbers[0] > 1 && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}
          {pageNumbers.map((pageNumber) => (
            <PaginationItem key={`page-${pageNumber}`}>
              <PaginationLink
                href="#"
                isActive={pageNumber === clampedPage}
                onClick={(event) => {
                  event.preventDefault();
                  table.setPageIndex(pageNumber - 1);
                }}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          ))}
          {pageNumbers[pageNumbers.length - 1] < pageCount && (
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              text=""
              className={
                clampedPage >= pageCount
                  ? "pointer-events-none opacity-50"
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault();
                table.nextPage();
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

/**
 * The `os-data-table` registry entry, and the shared table implementation
 * this app should reuse anywhere it needs one - built on the same v8
 * TanStack APIs (`useReactTable`, `getCoreRowModel`/`getSortedRowModel`/
 * `getPaginationRowModel`, `flexRender`) already used by every other table in
 * this codebase, plus the existing `FilterPopover`/`ColumnSettingsPopover` -
 * not a new table implementation, not a version upgrade. Pagination
 * (`DataTablePagination`, below) is private to this file - it has exactly
 * one caller, so it isn't a separately extracted component. Every feature
 * (search/filter/columns/selection/pagination) is a boolean prop; the caller
 * supplies `columns`/`data` the same way any
 * `useReactTable` caller would.
 */
export function OsDataTable<TData extends Record<string, unknown>>({
  title,
  subtitle,
  headerActions,
  actions,
  getActionRowLabel,
  data,
  columns,
  getRowId,
  searchable = true,
  searchPlaceholder = "Search...",
  searchFields,
  searchParam,
  filterable = true,
  filterFields = [],
  columnVisibility = true,
  defaultColumnOrder,
  structuralColumnIds = [],
  compulsoryColumns = [],
  minVisibleColumns = 1,
  selectable = true,
  selectionActions,
  paginated = true,
  pageSize = 10,
  pagination,
  pageParam,
  pageSizeParam,
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

  // `selectable` gets a checkbox column, and `actions` gets a trailing
  // "3 dots" menu column, both for free - the caller only supplies its own
  // *other* structural columns, so "just set a boolean/array" holds for the
  // two most common cases.
  const effectiveColumns = React.useMemo<ColumnDef<TData, unknown>[]>(() => {
    let result = columns;

    if (selectable) {
      const selectColumn: ColumnDef<TData, unknown> = {
        id: "select",
        header: ({ table }) => {
          let checked: boolean | "indeterminate" = false;
          if (table.getIsAllPageRowsSelected()) checked = true;
          else if (table.getIsSomePageRowsSelected()) checked = "indeterminate";

          return (
            <Checkbox
              checked={checked}
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
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
      result = [selectColumn, ...result];
    }

    if (actions && actions.length > 0) {
      const rowLabel =
        getActionRowLabel ??
        ((row: TData) =>
          getRowId ? getRowId(row, 0) : String(row.name ?? ""));
      result = [...result, buildActionsColumn(actions, rowLabel)];
    }

    return result;
  }, [selectable, actions, getActionRowLabel, getRowId, columns]);

  const effectiveStructuralColumnIds = React.useMemo(() => {
    const ids = [...structuralColumnIds];
    if (selectable) ids.unshift("select");
    if (actions && actions.length > 0) ids.push("actions");
    return ids;
  }, [selectable, actions, structuralColumnIds]);

  const structuralIds = React.useMemo(
    () => new Set(effectiveStructuralColumnIds),
    [effectiveStructuralColumnIds],
  );
  const allColumnIds = React.useMemo(
    () =>
      effectiveColumns
        .map((c) => columnId(c as ColumnDef<unknown, unknown>))
        .filter((id): id is string => Boolean(id)),
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

  const manualSearch = Boolean(searchParam);
  const { value: urlSearch, setValue: setUrlSearch } = useUrlParam(
    searchParam ?? "",
    pageParam ? [pageParam] : [],
  );

  const [searchInput, setSearchInput] = React.useState(() => urlSearch ?? "");
  const [search, setSearch] = React.useState("");
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (manualSearch) setUrlSearch(searchInput || null);
      else setSearch(searchInput);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput, manualSearch, setUrlSearch]);

  // Resyncs the visible box from the URL when it changes from outside this
  // component (browser back/forward, a Reset elsewhere) - a no-op for our
  // own debounced writes above, since `searchInput` already matches by the
  // time they land.
  React.useEffect(() => {
    if (manualSearch) setSearchInput(urlSearch ?? "");
  }, [manualSearch, urlSearch]);

  const [filterRows, setFilterRows] = React.useState<FilterRow[]>([]);

  const [columnsOpen, setColumnsOpen] = React.useState(false);
  const [columnPrefs, setColumnPrefs] = React.useState<ColumnPrefs>({
    columnOrder: defaultColumnOrder ?? manageableColumnIds,
  });

  const [rowSelection, setRowSelection] = React.useState({});
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [clientPagination, setClientPagination] =
    React.useState<PaginationState>(() => ({
      pageIndex: 0,
      pageSize: paginated ? pageSize : Number.MAX_SAFE_INTEGER,
    }));

  function handleFilterApply(rows: FilterRow[]) {
    setFilterRows(rows);
    setClientPagination((p) => ({ ...p, pageIndex: 0 }));
  }

  function handleClearSearchAndFilters() {
    setFilterRows([]);
    setClientPagination((p) => ({ ...p, pageIndex: 0 }));
    setSearchInput("");
    if (manualSearch) setUrlSearch(null);
    else setSearch("");
  }

  // Always called (Rules of Hooks) - inert when `manualPagination` is
  // false, since nothing reads `urlPage`/`setUrlPage` in that branch.
  const { page: urlPage, setPage: setUrlPage } = usePaginationParam(
    pageParam ?? "",
    pagination?.page ?? 1,
  );
  // Same inertness rule for page size - resetting `pageParam` in the same
  // navigation (via `resetParams`) is what keeps a size change from
  // stranding the user on a page number the new size no longer has.
  const { setValue: setUrlPageSize } = useUrlParam(
    pageSizeParam ?? "",
    pageParam ? [pageParam] : [],
  );

  const effectivePagination: PaginationState = manualPagination
    ? { pageIndex: urlPage - 1, pageSize: pagination.pageSize }
    : clientPagination;

  function handlePaginationChange(
    updater: React.SetStateAction<PaginationState>,
  ) {
    if (!manualPagination) {
      setClientPagination(updater);
      return;
    }
    if (!pageParam) return; // no stable identity to write a page number to
    const next =
      typeof updater === "function" ? updater(effectivePagination) : updater;
    setUrlPage(next.pageIndex + 1);
  }

  // Always called (Rules of Hooks) - inert when `manualSorting` is false.
  // Resetting `pageParam` (if any) alongside a sort write, not just a page
  // write, is what satisfies "changing sort resets the relevant page"
  // without OsFilterBar's involvement - see docs/UI_RUNTIME.md.
  const { value: urlSort, setValue: setUrlSort } = useUrlParam(
    sortParam ?? "",
    pageParam ? [pageParam] : [],
  );

  const effectiveSorting: SortingState = React.useMemo(() => {
    if (!manualSorting) return [];
    const value = urlSort ?? sort;
    if (!value) return [];
    const [field, direction] = value.trim().split(/\s+/);
    return field
      ? [{ id: field, desc: direction?.toLowerCase() === "desc" }]
      : [];
  }, [manualSorting, urlSort, sort]);

  function handleSortingChange(updater: React.SetStateAction<SortingState>) {
    if (!manualSorting) {
      setSorting(updater);
      return;
    }
    if (!sortParam) return; // no stable identity to write a sort to
    const next =
      typeof updater === "function" ? updater(effectiveSorting) : updater;
    const entry = next[0];
    setUrlSort(entry ? `${entry.id} ${entry.desc ? "desc" : "asc"}` : null);
  }

  const filteredData = React.useMemo(() => {
    let result = data;
    if (searchable && !manualSearch)
      result = applySearch(result, search, searchFields);
    if (filterable) result = applyFilterRows(result, filterRows, filterFields);
    return result;
  }, [
    data,
    searchable,
    manualSearch,
    search,
    searchFields,
    filterable,
    filterRows,
    filterFields,
  ]);

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
    const middle = columnPrefs.columnOrder.filter((id) =>
      manageableColumnIds.includes(id),
    );
    const remaining = manageableColumnIds.filter((id) => !middle.includes(id));
    return [...leading, ...middle, ...remaining, ...trailing];
  }, [
    columnVisibility,
    allColumnIds,
    structuralIds,
    columnPrefs,
    manageableColumnIds,
  ]);

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
    ...(manualPagination
      ? {}
      : { getPaginationRowModel: getPaginationRowModel() }),
  });

  // Plain boolean/truthiness checks, not "pick the first defined value" - `??`
  // would be wrong here (an empty-string `title` would then never fall
  // through to `subtitle`), so this deliberately isn't `a ?? b ?? c`.
  const hasHeader = [title, subtitle, headerActions].some(Boolean);

  // The *actual last visible* data column's header/cells right-align by
  // default - recomputed on every render (column visibility/order live in
  // TanStack's own state, not a static config), and never "actions" (it has
  // no header text to align) or "select" (always leading, never last). An
  // explicit `ColumnSpec.align` still wins over this - it sets `text-align`
  // directly on that column's own inner `<div>` (column-spec.tsx), which
  // overrides the value this inherits from the `<TableHead>`/`<TableCell>`
  // below rather than being overridden by it.
  const lastDataColumnId = table
    .getVisibleLeafColumns()
    .map((column) => column.id)
    .filter((id) => id !== "select" && id !== "actions")
    .at(-1);

  // Distinguishes "genuinely no data" (plain `emptyMessage`) from "a search
  // term or filter matched nothing" (an actionable empty state, since the
  // user can fix that themselves) - the client-side `search`/`filterRows`
  // when local, the URL's `urlSearch` when server-driven.
  const hasActiveQuery =
    (manualSearch ? Boolean(urlSearch) : Boolean(search)) ||
    filterRows.length > 0;

  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const showSelectionActions =
    selectable && Boolean(selectionActions?.length) && selectedCount > 0;

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
        {[searchable, filterable, columnVisibility, showSelectionActions].some(
          Boolean,
        ) && (
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
                    if (!manualSearch)
                      setClientPagination((p) => ({ ...p, pageIndex: 0 }));
                  }}
                />
              </InputGroup>
            )}

            {filterFields.length > 0 && (
              <ButtonGroup>
                <FilterPopover
                  availableFields={filterFields}
                  value={filterRows}
                  onApply={handleFilterApply}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filterRows.length === 0}
                  onClick={() => handleFilterApply([])}
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
                defaultColumnOrder={defaultColumnOrder ?? manageableColumnIds}
                minVisibleColumns={minVisibleColumns}
                compulsoryFields={compulsoryColumns}
                onSave={(prefs) => {
                  if (prefs.columnOrder.length < minVisibleColumns) return;
                  setColumnPrefs(prefs);
                }}
              />
            )}

            {showSelectionActions && (
              <div className="ml-auto">
                <SelectionActionsMenu
                  groups={selectionActions ?? []}
                  count={selectedCount}
                />
              </div>
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={
                        header.column.id === lastDataColumnId
                          ? "text-right"
                          : undefined
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          cell.column.id === lastDataColumnId
                            ? "text-right"
                            : undefined
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length}
                    className="text-center"
                  >
                    {hasActiveQuery ? (
                      <Empty className="py-10">
                        <EmptyTitle>No results found</EmptyTitle>
                        <EmptyDescription>
                          Try a different search term or adjust your filters.
                        </EmptyDescription>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearSearchAndFilters}
                        >
                          Clear Search &amp; Filters
                        </Button>
                      </Empty>
                    ) : (
                      emptyMessage
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {paginated && (
          <DataTablePagination
            table={table}
            totalCount={filteredData.length}
            itemLabel="entries"
            external={
              manualPagination
                ? {
                    hasMore: pagination.hasMore,
                    total: pagination.total,
                    onNext: () => setUrlPage(urlPage + 1),
                    onPrevious: () => setUrlPage(urlPage - 1),
                    disabled: !pageParam,
                    pageSize: pagination.pageSize,
                    onPageSizeChange: pageSizeParam
                      ? (size) =>
                          setUrlPageSize(
                            size === DEFAULT_PAGE_SIZE ? null : String(size),
                          )
                      : undefined,
                    onGoToPage: pageParam
                      ? (page) => setUrlPage(page)
                      : undefined,
                  }
                : undefined
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
