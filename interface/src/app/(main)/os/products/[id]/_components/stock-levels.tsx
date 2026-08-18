import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatQty } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import type { ItemDetail, ItemStockRow, ItemStockTotals } from "@/types/products";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-lg tabular-nums">{value}</span>
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="px-6 pb-6 text-muted-foreground text-sm">{children}</div>;
}

function StockTable({ bins, totals, currency }: { bins: ItemStockRow[]; totals: ItemStockTotals; currency?: string }) {
  return (
    <div className="overflow-x-auto">
      <Table className="w-full **:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
        <TableHeader>
          <TableRow>
            <TableHead className="py-3 font-medium">Warehouse</TableHead>
            <TableHead className="py-3 text-right font-medium">Actual</TableHead>
            <TableHead className="py-3 text-right font-medium">Reserved</TableHead>
            <TableHead className="py-3 text-right font-medium">Ordered</TableHead>
            <TableHead className="py-3 text-right font-medium">Requested</TableHead>
            <TableHead className="py-3 text-right font-medium">Projected</TableHead>
            <TableHead className="py-3 text-right font-medium">Valuation Rate</TableHead>
            <TableHead className="py-3 text-right font-medium">Stock Value</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {bins.map((bin) => (
            <TableRow key={bin.warehouse} className="border-border/60">
              <TableCell className="py-3 font-medium">{bin.warehouse}</TableCell>
              <TableCell className="py-3 text-right tabular-nums">
                {formatQty(bin.actual_qty)}
                <span className="text-muted-foreground"> {bin.stock_uom}</span>
              </TableCell>
              <TableCell className="py-3 text-right tabular-nums">{formatQty(bin.reserved_qty)}</TableCell>
              <TableCell className="py-3 text-right tabular-nums">{formatQty(bin.ordered_qty)}</TableCell>
              <TableCell className="py-3 text-right tabular-nums">{formatQty(bin.indented_qty)}</TableCell>
              <TableCell className="py-3 text-right font-medium tabular-nums">{formatQty(bin.projected_qty)}</TableCell>
              <TableCell className="py-3 text-right tabular-nums">
                {formatCurrency(bin.valuation_rate, { currency })}
              </TableCell>
              <TableCell className="py-3 text-right tabular-nums">
                {formatCurrency(bin.stock_value, { currency })}
              </TableCell>
            </TableRow>
          ))}

          {/* Totals repeat the header metrics at the foot of the table so a
           * long warehouse list still adds up on screen. */}
          <TableRow className="border-border/60 bg-muted/40 font-medium hover:bg-muted/40">
            <TableCell className="py-3">All warehouses</TableCell>
            <TableCell className="py-3 text-right tabular-nums">{formatQty(totals.actual_qty)}</TableCell>
            <TableCell className="py-3 text-right tabular-nums">{formatQty(totals.reserved_qty)}</TableCell>
            <TableCell className="py-3 text-right tabular-nums">{formatQty(totals.ordered_qty)}</TableCell>
            <TableCell className="py-3 text-right tabular-nums">{formatQty(totals.indented_qty)}</TableCell>
            <TableCell className="py-3 text-right tabular-nums">{formatQty(totals.projected_qty)}</TableCell>
            <TableCell className="py-3" />
            <TableCell className="py-3 text-right tabular-nums">
              {formatCurrency(totals.stock_value, { currency })}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

/** Per-warehouse stock, straight off Bin. ERPNext creates a Bin lazily on the
 * first movement, so a warehouse the item has never been in has no row here —
 * "no rows" means "never transacted", not "zero on hand everywhere". */
export function StockLevels({
  stock,
  canRead,
  isStockItem,
  currency,
}: {
  stock: ItemDetail["stock"];
  canRead: boolean;
  isStockItem: boolean;
  currency?: string;
}) {
  const { bins, totals } = stock;

  return (
    <Card className="gap-0">
      <CardHeader className="border-b pb-4">
        <CardTitle className="font-normal text-muted-foreground text-sm">Stock</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {canRead ? `${formatQty(totals.actual_qty)} on hand` : "Not shown"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 px-0 pt-4">
        {canRead && bins.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4 px-6 sm:grid-cols-4">
              <Metric label="Reserved" value={formatQty(totals.reserved_qty)} />
              <Metric label="Ordered" value={formatQty(totals.ordered_qty)} />
              <Metric label="Projected" value={formatQty(totals.projected_qty)} />
              <Metric label="Stock Value" value={formatCurrency(totals.stock_value, { currency })} />
            </div>
            <StockTable bins={bins} totals={totals} currency={currency} />
          </>
        )}

        {!canRead && <Message>You don&apos;t have permission to view stock levels.</Message>}
        {canRead && bins.length === 0 && !isStockItem && (
          <Message>This is not a stock item, so no stock is tracked against it.</Message>
        )}
        {canRead && bins.length === 0 && isStockItem && (
          <Message>This item has never been transacted in any warehouse.</Message>
        )}
      </CardContent>
    </Card>
  );
}
