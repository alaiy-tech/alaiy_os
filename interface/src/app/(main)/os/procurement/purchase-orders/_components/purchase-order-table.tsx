"use client";
"use no memo";

import { flexRender, type Table as TableType } from "@tanstack/react-table";

import { PaginationFooter } from "@/components/layout/pagination-footer";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PurchaseOrderRow } from "@/types/purchase-orders";

export function PurchaseOrderTable({
  table,
  isLoading,
  totalCount,
  emptyMessage = "No results.",
  onRowClick,
}: {
  table: TableType<PurchaseOrderRow>;
  isLoading: boolean;
  totalCount: number;
  /** Worded for the active status tab — "No orders to receive" says more than
   * "No results" when the user is standing on the To Receive tab. */
  emptyMessage?: string;
  onRowClick?: (row: PurchaseOrderRow) => void;
}) {
  const columnSizing = table.getState().columnSizing;

  // Only the checkbox column gets a fixed width - every real data column
  // stays unset (browser auto table-layout fills the available width)
  // unless the user has actually dragged its resize handle.
  function widthFor(columnId: string, fixedSize: number): number | undefined {
    if (columnId === "select") return fixedSize;
    return columnSizing[columnId];
  }

  function messageRow(message: string) {
    return (
      <TableRow>
        <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center text-muted-foreground">
          {message}
        </TableCell>
      </TableRow>
    );
  }

  function renderBody() {
    if (isLoading) return messageRow("Loading orders…");

    const rows = table.getRowModel().rows;
    if (!rows.length) return messageRow(emptyMessage);

    return rows.map((row) => (
      <TableRow
        key={row.id}
        className={cn("border-border/60 hover:bg-muted/40", onRowClick && "cursor-pointer")}
        data-state={row.getIsSelected() && "selected"}
        onClick={(event) => {
          // The row is a click target, but it also contains real controls —
          // the select checkbox and the PO # link. Let those handle their own
          // clicks rather than navigating out from under them.
          if (!onRowClick) return;
          if ((event.target as HTMLElement).closest("a,button,input,[role='checkbox']")) return;
          onRowClick(row.original);
        }}
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell
            key={cell.id}
            className={cn("px-3 py-3 align-middle", cell.column.columnDef.meta?.align === "right" && "text-right")}
            style={{ width: widthFor(cell.column.id, cell.column.getSize()) }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    ));
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="overflow-x-auto">
        <Table className="w-full **:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
          <TableHeader className="[&_tr]:border-t">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "relative py-3 font-medium select-none",
                      header.column.columnDef.meta?.align === "right" && "text-right",
                    )}
                    style={{ width: widthFor(header.column.id, header.getSize()) }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanResize() && (
                      <button
                        type="button"
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        aria-label="Resize column"
                        className={cn(
                          "absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none",
                          header.column.getIsResizing() ? "bg-primary" : "hover:bg-border",
                        )}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>{renderBody()}</TableBody>
        </Table>
      </div>

      <Separator />

      <PaginationFooter table={table} totalCount={totalCount} itemLabel="orders" />
    </div>
  );
}
