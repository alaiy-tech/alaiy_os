import Link from "next/link";

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
} from "@/constants/sales-orders";
import { formatDate } from "@/lib/format";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  LinkedDeliveryNote,
  LinkedSalesInvoice,
} from "@/types/sales-orders";

/** Neither doctype has a page in this app yet (#129, #128), so a row opens the
 * desk record — see the /os/open route handler. Each of these becomes a
 * native link as its detail page lands. */
function documentHref(doctype: string, name: string): string {
  return `/os/open/${doctype}/${encodeURIComponent(name)}`;
}

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

export function DeliveryNotes({
  notes,
  currency,
}: {
  notes: LinkedDeliveryNote[];
  currency?: string;
}) {
  return (
    <Shell
      title="Delivery"
      count={notes.length}
      emptyMessage="Nothing delivered against this order yet."
      headers={["Delivery Note", "Date", "Status", "Total"]}
    >
      {notes.map((note) => (
        <TableRow key={note.name} className="border-border/60">
          <TableCell className="py-3 font-medium">
            <Link
              href={documentHref("delivery-note", note.name)}
              className="underline-offset-4 hover:underline"
            >
              {note.name}
            </Link>
          </TableCell>
          <TableCell className="py-3">
            {formatDate(note.posting_date)}
          </TableCell>
          <TableCell className="py-3">
            <StatusBadges
              status={note.status}
              docstatus={note.docstatus}
              isReturn={note.is_return}
            />
          </TableCell>
          <TableCell className="py-3 text-right tabular-nums">
            {formatCurrency(note.grand_total ?? 0, {
              currency: note.currency ?? currency,
            })}
          </TableCell>
        </TableRow>
      ))}
    </Shell>
  );
}

export function SalesInvoices({
  invoices,
  currency,
}: {
  invoices: LinkedSalesInvoice[];
  currency?: string;
}) {
  return (
    <Shell
      title="Billing"
      count={invoices.length}
      emptyMessage="Nothing billed against this order yet."
      headers={["Invoice", "Date", "Status", "Outstanding", "Total"]}
    >
      {invoices.map((invoice) => (
        <TableRow key={invoice.name} className="border-border/60">
          <TableCell className="py-3">
            <div className="flex flex-col gap-1">
              <Link
                href={documentHref("sales-invoice", invoice.name)}
                className="font-medium underline-offset-4 hover:underline"
              >
                {invoice.name}
              </Link>
              {invoice.due_date && (
                <span className="text-muted-foreground text-xs">
                  Due {formatDate(invoice.due_date)}
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
