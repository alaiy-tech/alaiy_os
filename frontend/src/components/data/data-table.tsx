import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { type Table as TanstackTable, flexRender } from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface DataTableProps<TData> {
  table: TanstackTable<TData>;
  isLoading?: boolean;
  error?: { message?: string } | null;
  onRowClick?: (row: TData) => void;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  skeletonRowCount?: number;
  /** Rendered inside the same card, below the table (e.g. DataTablePagination). */
  footer?: ReactNode;
}

/**
 * Presentational renderer for a TanStack Table instance, styled to the
 * approved design (surface-faint header, hairline row borders, hover tint).
 * Build the table with useDataTable() / useReactTable() and pass it in -
 * this component only renders. See docs/adding-a-screen.md.
 */
export function DataTable<TData>({
  table,
  isLoading,
  error,
  onRowClick,
  emptyIcon: EmptyIcon,
  emptyTitle = "No records match these filters",
  emptyDescription = "Try a different filter, or clear the search.",
  skeletonRowCount = 8,
  footer,
}: DataTableProps<TData>) {
  const columnCount = table.getAllColumns().filter((c) => c.getIsVisible()).length;
  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error.message || "Couldn't load this list."}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-visible rounded-[10px] border border-line-subtle bg-background">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={header.column.columnDef.size ? { width: header.column.columnDef.size } : undefined}
                    className="whitespace-nowrap bg-surface-faint py-[9px] text-[11px] font-medium tracking-[.06em] text-ash uppercase"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: skeletonRowCount }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="border-line-faint">
                  {Array.from({ length: columnCount }).map((__, j) => (
                    <TableCell key={j} className="py-[10px]">
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && !error && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-14 text-center">
                  {EmptyIcon && (
                    <span className="mb-3.5 inline-flex size-10 items-center justify-center rounded-[9px] border border-line-subtle bg-secondary text-ash">
                      <EmptyIcon className="size-[19px]" />
                    </span>
                  )}
                  <div className="text-[14.5px] font-semibold tracking-[-.015em] text-ink">{emptyTitle}</div>
                  <div className="mt-[5px] text-[13px] text-ash">{emptyDescription}</div>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn("border-line-faint", onRowClick && "cursor-pointer")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-[9px]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {footer}
      </div>
    </div>
  );
}
