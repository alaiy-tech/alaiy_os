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
import {
  DEFAULT_STATUS_BADGE_CLASS,
  LINKED_DOC_BADGE_CLASS,
} from "@/constants/purchase-orders";
import { formatDate } from "@/lib/format";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  LinkedPurchaseInvoice,
  LinkedPurchaseReceipt,
} from "@/types/purchase-orders";

/** A draft carries no status of its own worth showing (ERPNext leaves it as
 * "Draft"), and a return is worth calling out next to the document it
 * reverses — its totals are negative and would otherwise read as an error. */
function StatusBadges({
  status,
  docstatus,
  isReturn,
}: {
  status: string | null;
  docstatus: number;
  isReturn: number;
}) {
  const label = docstatus === 0 ? "Draft" : (status ?? "—");
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge
        variant="outline"
        className={cn(
          "border-0 font-medium",
          LINKED_DOC_BADGE_CLASS[label] ?? DEFAULT_STATUS_BADGE_CLASS,
        )}
      >
        {label}
      </Badge>
      {!!isReturn && (
        <Badge
          variant="outline"
          className={cn("border-0 font-medium", LINKED_DOC_BADGE_CLASS.Return)}
        >
          Return
        </Badge>
      )}
    </div>
  );
}

function Shell({
  title,
  count,
  emptyMessage,
  headers,
  children,
}: {
  title: string;
  count: number;
  emptyMessage: string;
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="border-b pb-4">
        <CardTitle className="font-normal text-muted-foreground text-sm">
          {title}
        </CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {count}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table className="w-full **:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                {headers.map((header, index) => (
                  <TableHead
                    key={header}
                    className={cn(
                      "py-3 font-medium",
                      index >= headers.length - 1 && "text-right",
                    )}
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {count === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={headers.length}
                    className="h-20 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                children
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function LinkedReceipts({
  receipts,
  currency,
}: {
  receipts: LinkedPurchaseReceipt[];
  currency?: string;
}) {
  return (
    <Shell
      title="Purchase Receipts"
      count={receipts.length}
      emptyMessage="Nothing received against this order yet."
      headers={["Receipt", "Date", "Status", "Total"]}
    >
      {receipts.map((receipt) => (
        <TableRow key={receipt.name} className="border-border/60">
          <TableCell className="py-3 font-medium">{receipt.name}</TableCell>
          <TableCell className="py-3">
            {formatDate(receipt.posting_date)}
          </TableCell>
          <TableCell className="py-3">
            <StatusBadges
              status={receipt.status}
              docstatus={receipt.docstatus}
              isReturn={receipt.is_return}
            />
          </TableCell>
          <TableCell className="py-3 text-right tabular-nums">
            {formatCurrency(receipt.grand_total ?? 0, {
              currency: receipt.currency ?? currency,
            })}
          </TableCell>
        </TableRow>
      ))}
    </Shell>
  );
}

export function LinkedInvoices({
  invoices,
  currency,
}: {
  invoices: LinkedPurchaseInvoice[];
  currency?: string;
}) {
  return (
    <Shell
      title="Purchase Invoices"
      count={invoices.length}
      emptyMessage="Nothing billed against this order yet."
      headers={["Invoice", "Date", "Status", "Outstanding", "Total"]}
    >
      {invoices.map((invoice) => (
        <TableRow key={invoice.name} className="border-border/60">
          <TableCell className="py-3">
            <div className="flex flex-col gap-1">
              <span className="font-medium">{invoice.name}</span>
              {invoice.bill_no && (
                <span className="text-muted-foreground text-xs">
                  Supplier ref {invoice.bill_no}
                </span>
              )}
            </div>
          </TableCell>
          <TableCell className="py-3">
            {formatDate(invoice.posting_date)}
          </TableCell>
          <TableCell className="py-3">
            <StatusBadges
              status={invoice.status}
              docstatus={invoice.docstatus}
              isReturn={invoice.is_return}
            />
          </TableCell>
          <TableCell className="py-3 text-right tabular-nums">
            {formatCurrency(invoice.outstanding_amount ?? 0, {
              currency: invoice.currency ?? currency,
            })}
          </TableCell>
          <TableCell className="py-3 text-right tabular-nums">
            {formatCurrency(invoice.grand_total ?? 0, {
              currency: invoice.currency ?? currency,
            })}
          </TableCell>
        </TableRow>
      ))}
    </Shell>
  );
}
