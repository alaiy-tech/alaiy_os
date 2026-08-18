import { Badge } from "@/components/primitive/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/primitive/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/primitive/table";
import { formatQty, labelOr } from "@/lib/format";
import { cn, formatCurrency } from "@/lib/utils";
import type { SalesOrderLine } from "@/types/sales-orders";

/** Delivered and Billed are shown against the ordered qty rather than alone, so
 * a line reads as "3 of 10" without the reader holding the Qty column in their
 * head. A short line is muted; a fully covered one is quietly green. */
function CoverageCell({
  covered,
  ordered,
}: {
  covered: number;
  ordered: number;
}) {
  const isComplete = ordered > 0 && covered >= ordered;
  return (
    <span
      className={cn(
        "tabular-nums",
        isComplete
          ? "text-green-700 dark:text-green-300"
          : "text-muted-foreground",
      )}
    >
      {formatQty(covered)}
      <span className="text-muted-foreground"> / {formatQty(ordered)}</span>
    </span>
  );
}

/** ERPNext defaults a line's description to its item name and stores the HTML
 * the desk editor produced. Repeating the name under itself is noise, so an
 * unedited description is dropped and what's left is rendered as plain text. */
function lineDescription(item: SalesOrderLine): string | null {
  const text = (item.description ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text === item.item_name?.trim() || text === item.item_code.trim())
    return null;
  return text;
}

export function OrderLines({
  items,
  currency,
}: {
  items: SalesOrderLine[];
  currency?: string;
}) {
  const money = (value: number) => formatCurrency(value, { currency });

  return (
    <Card className="gap-0">
      <CardHeader className="border-b pb-4">
        <CardTitle className="font-normal text-muted-foreground text-sm">
          Line Items
        </CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {items.length} {items.length === 1 ? "line" : "lines"}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="w-full **:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-medium">Item</TableHead>
                <TableHead className="py-3 text-right font-medium">
                  Qty
                </TableHead>
                <TableHead className="py-3 text-right font-medium">
                  Delivered
                </TableHead>
                <TableHead className="py-3 text-right font-medium">
                  Billed
                </TableHead>
                <TableHead className="py-3 text-right font-medium">
                  Rate
                </TableHead>
                <TableHead className="py-3 text-right font-medium">
                  Amount
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    This order has no lines.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const description = lineDescription(item);
                  const outstanding = Math.max(
                    item.qty - item.delivered_qty,
                    0,
                  );

                  return (
                    <TableRow key={item.name} className="border-border/60">
                      <TableCell className="py-3 align-top">
                        <div className="flex max-w-md flex-col gap-1">
                          <span className="font-medium">
                            {labelOr(item.item_name, item.item_code)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {item.item_code}
                          </span>
                          {description && (
                            <span className="text-muted-foreground text-xs">
                              {description}
                            </span>
                          )}
                          {outstanding > 0 && (
                            <Badge
                              variant="outline"
                              className="w-fit border-0 bg-muted font-normal text-xs"
                            >
                              {formatQty(outstanding)} {item.uom} to deliver
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-right align-top tabular-nums">
                        {formatQty(item.qty)}
                        <span className="text-muted-foreground">
                          {" "}
                          {item.uom}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-right align-top">
                        <CoverageCell
                          covered={item.delivered_qty}
                          ordered={item.qty}
                        />
                      </TableCell>
                      <TableCell className="py-3 text-right align-top">
                        <CoverageCell
                          covered={item.billed_qty}
                          ordered={item.qty}
                        />
                      </TableCell>
                      <TableCell className="py-3 text-right align-top tabular-nums">
                        {money(item.rate)}
                      </TableCell>
                      <TableCell className="py-3 text-right align-top font-medium tabular-nums">
                        {money(item.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
