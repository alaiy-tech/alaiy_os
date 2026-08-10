"use client";

import type { Table as TableType } from "@tanstack/react-table";

import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

/** Rows-per-page + page count + prev/next, driven by a TanStack table's own
 * pagination state - shared by every list/grid view so the same table
 * instance's pagination works identically no matter how the rows themselves
 * are rendered. */
export function PaginationFooter<T>({
  table,
  totalCount,
  itemLabel,
}: {
  table: TableType<T>;
  totalCount: number;
  itemLabel: string;
}) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = Math.max(Math.ceil(totalCount / pageSize), 1);
  const currentPage = Math.min(pageIndex + 1, pageCount);

  return (
    <div className="flex items-center justify-between px-4">
      <div className="flex items-center gap-4 text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <span>Per page</span>
          <Select value={`${pageSize}`} onValueChange={(value) => table.setPageSize(Number(value))}>
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
          Page {currentPage} of {pageCount} · {totalCount} {itemLabel}
        </span>
      </div>

      <Pagination className="mx-0 w-auto justify-start md:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text=""
              className={pageIndex === 0 ? "pointer-events-none opacity-50" : undefined}
              onClick={(event) => {
                event.preventDefault();
                table.previousPage();
              }}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              text=""
              className={currentPage >= pageCount ? "pointer-events-none opacity-50" : undefined}
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
