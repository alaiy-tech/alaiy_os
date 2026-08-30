/** Which page-number links to show around the current page - always the
 * current page plus one neighbour on each side, clamped to the real range,
 * so the caller knows when to render an ellipsis on either end. Used by
 * `OsDataTable`'s own local (known-total) pagination branch
 * (`components/registry/data-table/data-table.tsx`). */
export function getPageNumbers(currentPage: number, pageCount: number): number[] {
  if (pageCount <= 3) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 2) return [1, 2, 3];
  if (currentPage >= pageCount - 1) return [pageCount - 2, pageCount - 1, pageCount];

  return [currentPage - 1, currentPage, currentPage + 1];
}
