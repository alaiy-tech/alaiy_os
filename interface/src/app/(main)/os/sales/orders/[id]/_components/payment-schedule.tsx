import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { todayIso } from "@/lib/dates";
import { formatDate, labelOr } from "@/lib/format";
import { cn, formatCurrency } from "@/lib/utils";
import type { SalesOrderPaymentTerm } from "@/types/sales-orders";

/** Whether an instalment is settled.
 *
 * `outstanding` is the figure ERPNext maintains as payment entries land, but it
 * is only written once the schedule has been touched — a freshly submitted
 * order leaves it null rather than at the full amount. `paid_amount` covers
 * that case, so both are consulted before calling a row paid. */
function isPaid(term: SalesOrderPaymentTerm): boolean {
  const amount = term.payment_amount ?? 0;
  if (term.outstanding !== null && term.outstanding !== undefined) return term.outstanding <= 0;
  return amount > 0 && (term.paid_amount ?? 0) >= amount;
}

export function PaymentSchedule({ terms, currency }: { terms: SalesOrderPaymentTerm[]; currency?: string }) {
  const money = (value: number | null | undefined) => formatCurrency(value ?? 0, { currency });
  const today = todayIso();

  return (
    <Card className="gap-0">
      <CardHeader className="border-b pb-4">
        <CardTitle className="font-normal text-muted-foreground text-sm">Payment Schedule</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {terms.length} {terms.length === 1 ? "instalment" : "instalments"}
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="w-full **:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-medium">Term</TableHead>
                <TableHead className="py-3 font-medium">Due</TableHead>
                <TableHead className="py-3 font-medium">Paid</TableHead>
                <TableHead className="py-3 text-right font-medium">Amount</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {terms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                    This order is on no payment schedule.
                  </TableCell>
                </TableRow>
              ) : (
                terms.map((term) => {
                  const paid = isPaid(term);
                  // Only an unpaid instalment can be overdue; a settled one
                  // whose date has passed is simply history.
                  const overdue = !paid && !!term.due_date && term.due_date < today;

                  return (
                    <TableRow key={term.idx} className="border-border/60">
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-0.5">
                          <span>{labelOr(term.payment_term, labelOr(term.description, `Instalment ${term.idx}`))}</span>
                          {term.invoice_portion ? (
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {term.invoice_portion}% of the order
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <span
                          className={cn(
                            "inline-flex rounded px-1.5 py-0.5",
                            overdue && "bg-destructive/10 font-medium text-destructive",
                          )}
                          title={overdue ? "Payment is past due" : undefined}
                        >
                          {formatDate(term.due_date)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-0 font-medium",
                            paid
                              ? "bg-success/10 text-success-foreground dark:bg-success/15"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {paid ? "Paid" : "Unpaid"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right align-top tabular-nums">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{money(term.payment_amount)}</span>
                          {!paid && !!term.paid_amount && (
                            <span className="text-muted-foreground text-xs">{money(term.paid_amount)} paid</span>
                          )}
                        </div>
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
