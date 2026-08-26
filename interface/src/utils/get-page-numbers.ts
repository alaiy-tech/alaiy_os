/** Which page-number links to show around the current page - always the
 * current page plus one neighbour on each side, clamped to the real range,
 * so the caller knows when to render an ellipsis on either end. Shared by
 * every table with a known total page count (`PaginationFooter`'s local
 * branch, `UsersTable`). */
export function getPageNumbers(currentPage: number, pageCount: number): number[] {
  if (pageCount <= 3) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 2) return [1, 2, 3];
  if (currentPage >= pageCount - 1) return [pageCount - 2, pageCount - 1, pageCount];

  return [currentPage - 1, currentPage, currentPage + 1];
}
