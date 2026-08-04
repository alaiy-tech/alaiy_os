import { Button } from "@/components/ui/button";

export interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  rowCount: number;
  totalCount?: number;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}

export function DataTablePagination({ page, pageSize, rowCount, totalCount, hasNextPage, onPageChange }: DataTablePaginationProps) {
  const from = page * pageSize + 1;
  const to = page * pageSize + rowCount;
  const totalLabel = totalCount !== undefined ? totalCount.toLocaleString("en-IN") : "many";

  return (
    <div className="flex items-center justify-between border-t border-line-subtle px-[18px] py-[11px]">
      <span className="text-[12.5px] tabular-nums text-ash">
        {rowCount > 0 ? `Showing ${from} to ${to} of ${totalLabel} entries` : "No entries"}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-8 text-[12.5px]" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-[12.5px]" disabled={!hasNextPage} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
