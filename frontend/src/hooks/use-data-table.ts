import { useState } from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  type VisibilityState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

interface UseDataTableOptions<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  getRowId?: (row: TData) => string;
  enableRowSelection?: boolean;
}

/**
 * Thin wrapper around useReactTable: owns column-visibility and row-selection
 * UI state so every screen's toolbar (search, filters, Columns toggle) can
 * share one DataTable/DataTableColumnToggle pair. Pagination is NOT handled
 * here - Frappe paginates server-side, so callers manage page/pageSize with
 * useDoctypeList and pass already-paged `data` in.
 */
export function useDataTable<TData>({ columns, data, getRowId, enableRowSelection }: UseDataTableOptions<TData>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { columnVisibility, rowSelection },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return table;
}
