import type { ReactNode } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  /** Custom cell renderer. Falls back to `row[key]` when omitted. */
  render?: (row: T) => ReactNode;
  className?: string;
};

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  error?: { message?: string } | null;
  onRowClick?: (row: T) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  page: number;
  pageSize: number;
  /** True when a fetch for the next page could return more rows. */
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
}

/**
 * Generic paginated, searchable table. New doctype screens plug in a
 * `columns` config rather than hand-rolling markup - see
 * docs/adding-a-screen.md.
 */
export function DataTable<T extends object>({
  columns,
  data,
  getRowId,
  isLoading,
  error,
  onRowClick,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  page,
  pageSize,
  hasNextPage,
  onPageChange,
  emptyMessage = "No records found.",
}: DataTableProps<T>) {
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error.message || "Couldn't load this list."}</AlertDescription>
        </Alert>
      )}

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: pageSize > 8 ? 8 : pageSize }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && !error && data.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              data.map((row) => (
                <TableRow
                  key={getRowId(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Page {page + 1}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="size-4" />
            Prev
          </Button>
          <Button variant="outline" size="sm" disabled={!hasNextPage} onClick={() => onPageChange(page + 1)}>
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
