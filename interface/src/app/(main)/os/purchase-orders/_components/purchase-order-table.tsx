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
}: {
  table: TableType<PurchaseOrderRow>;
  isLoading: boolean;
  totalCount: number;
}) {
  const columnSizing = table.getState().columnSizing;

  // Only the checkbox column gets a fixed width - every real data column
  // stays unset (browser auto table-layout fills the available width)
  // unless the user has actually dragged its resize handle.
  function widthFor(columnId: string, fixedSize: number): number | undefined {
    if (columnId === "select") return fixedSize;
    return columnSizing[columnId];
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
                    className="relative py-3 font-medium select-none"
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

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading orders…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-border/60 hover:bg-muted/40"
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-3 py-3 align-middle"
                      style={{ width: widthFor(cell.column.id, cell.column.getSize()) }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Separator />

      <PaginationFooter table={table} totalCount={totalCount} itemLabel="orders" />
    </div>
  );
}
