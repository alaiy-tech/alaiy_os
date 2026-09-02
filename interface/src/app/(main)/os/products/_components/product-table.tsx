"use client";
"use no memo";

import { Fragment } from "react";

import { flexRender, type Table as TableType } from "@tanstack/react-table";

import { PaginationFooter } from "@/components/layout/pagination-footer";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ProductRow } from "@/types/products";

import { hasProductChildren, ProductChildRows } from "./product-child-rows";

export function ProductTable({
  table,
  isLoading,
  totalCount,
  expandedIds,
  onRowClick,
  currency,
}: {
  table: TableType<ProductRow>;
  isLoading: boolean;
  totalCount: number;
  expandedIds: Set<string>;
  onRowClick?: (row: ProductRow) => void;
  currency?: string;
}) {
  const columnSizing = table.getState().columnSizing;

  // Only the checkbox/expand utility columns get a fixed width - every real
  // data column stays unset (browser auto table-layout fills the available
  // width) unless the user has actually dragged its resize handle, at which
  // point columnSizing carries an explicit override for it.
  function widthFor(columnId: string, fixedSize: number): number | undefined {
    if (columnId === "select" || columnId === "expand") return fixedSize;
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
                    className={cn(
                      "relative py-4 font-normal select-none",
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

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading products…
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow
                    className={cn("border-border/60 hover:bg-muted/40", onRowClick && "cursor-pointer")}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={(event) => {
                      // The row is a click target, but it also contains real
                      // controls — the select checkbox, the variant expander and
                      // the ID/name links. Let those handle their own clicks
                      // rather than navigating out from under them.
                      if (!onRowClick) return;
                      if ((event.target as HTMLElement).closest("a,button,input,[role='checkbox']")) return;
                      onRowClick(row.original);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "px-3 py-3 align-middle",
                          cell.column.columnDef.meta?.align === "right" && "text-right",
                        )}
                        style={{ width: widthFor(cell.column.id, cell.column.getSize()) }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {hasProductChildren(row.original) && expandedIds.has(row.original.name) && (
                    <ProductChildRows row={row.original} colSpan={row.getVisibleCells().length} currency={currency} />
                  )}
                </Fragment>
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

      <PaginationFooter table={table} totalCount={totalCount} itemLabel="products" />
    </div>
  );
}
