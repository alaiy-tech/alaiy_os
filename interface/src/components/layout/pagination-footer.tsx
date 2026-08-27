"use client";
"use no memo";

// This component reads pageIndex/pageSize off the table instance, and
// useReactTable hands back one mutable object whose identity never changes.
// React Compiler caches on reference identity, so without "use no memo" it
// evaluates table.getState() once and pins the footer to first-page state for
// good: "Page 1 of N" never moves, Previous never re-enables, Next never
// disables, and the per-page select keeps reporting 10. sales-orders.tsx and
// the list tables carry the directive for the same reason.

import { useState } from "react";

import type { Table as TableType } from "@tanstack/react-table";

import { Input } from "@/components/primitive/input";
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
import { PAGE_SIZE_OPTIONS } from "@/constants/list";
import { getPageNumbers } from "@/utils/get-page-numbers";

/** Overrides the default `totalCount`-derived rendering for a table whose
 * rows come from a server/generic data source that only knows `hasMore`,
 * not a true total (`FrappeListResult.pagination`, for example) - see
 * `docs/UI_RUNTIME.md`'s "Paginated Data Sources". `disabled` forces both
 * buttons off regardless of `hasMore`/page - used when the table has no
 * stable identity to page against (no `pageParam`), so paging would have
 * nothing to write to. */
export type PaginationFooterExternalState = {
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
   * of numbered page links in this mode, since only `hasMore` is known here,
   * never a true total to render real page numbers against. */
  onGoToPage?: (page: number) => void;
};

function GoToPageInput({ disabled, onGoToPage }: { disabled?: boolean; onGoToPage: (page: number) => void }) {
  const [value, setValue] = useState("");

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

/** Rows-per-page + page count + prev/next, driven by a TanStack table's own
 * pagination state - shared by every list/grid view so the same table
 * instance's pagination works identically no matter how the rows themselves
 * are rendered. */
export function PaginationFooter<T>({
  table,
  totalCount,
  itemLabel,
  external,
}: {
  table: TableType<T>;
  totalCount?: number;
  itemLabel: string;
  external?: PaginationFooterExternalState;
}) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const currentPage = pageIndex + 1;

  if (external) {
    const canGoBack = !external.disabled && currentPage > 1;
    const canGoForward = !external.disabled && external.hasMore;
    const effectivePageSize = external.pageSize ?? pageSize;

    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-4 text-muted-foreground text-sm">
          {external.onPageSizeChange && (
            <div className="flex items-center gap-2">
              <span>Per page</span>
              <Select
                value={`${effectivePageSize}`}
                onValueChange={(value) => external.onPageSizeChange?.(Number(value))}
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
          {external.onGoToPage && <GoToPageInput disabled={external.disabled} onGoToPage={external.onGoToPage} />}

          <Pagination className="mx-0 w-auto justify-start md:justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text=""
                  className={canGoBack ? undefined : "pointer-events-none opacity-50"}
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
                  className={canGoForward ? undefined : "pointer-events-none opacity-50"}
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
    <div className="flex flex-wrap items-center justify-between gap-2 px-4">
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
          Page {clampedPage} of {pageCount} · {totalCount} {itemLabel}
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
              className={clampedPage >= pageCount ? "pointer-events-none opacity-50" : undefined}
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
