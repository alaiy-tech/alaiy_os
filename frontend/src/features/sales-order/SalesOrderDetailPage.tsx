import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { useFrappeGetDoc } from "frappe-react-sdk";
import { Check, Printer } from "lucide-react";

import { DetailView, type DetailSection } from "@/components/data/DetailView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { statusTone } from "@/lib/status";

interface SalesOrderItemRow {
  name: string;
  item_code: string;
  item_name: string;
  warehouse: string;
  qty: number;
  delivered_qty: number;
  rate: number;
  amount: number;
}

interface PaymentScheduleRow {
  name: string;
  payment_term: string | null;
  due_date: string;
  payment_amount: number;
}

interface SalesOrderDoc {
  name: string;
  customer: string;
  customer_name: string;
  territory: string;
  order_type: string;
  status: string;
  docstatus: 0 | 1 | 2;
  company: string;
  currency: string;
  selling_price_list: string;
  total: number;
  total_taxes_and_charges: number;
  grand_total: number;
  advance_paid: number;
  total_qty: number;
  per_delivered: number;
  per_billed: number;
  transaction_date: string;
  delivery_date: string | null;
  po_no: string | null;
  shipping_address_display: string | null;
  contact_display: string | null;
  contact_email: string | null;
  contact_mobile: string | null;
  items: SalesOrderItemRow[];
  payment_schedule: PaymentScheduleRow[];
  owner: string;
}

const DOCSTATUS_LABEL = { 0: "Draft", 1: "Submitted", 2: "Cancelled" } as const;

function initials(value: string) {
  return value.split(" ").slice(0, 2).map((w) => w[0]).join("");
}

export default function SalesOrderDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useFrappeGetDoc<SalesOrderDoc>("Sales Order", id);

  const steps = data
    ? [
        { label: "Draft", done: true, meta: formatDate(data.transaction_date) },
        { label: "Submitted", done: data.docstatus >= 1, meta: data.docstatus >= 1 ? "Submitted" : "pending" },
        { label: "Partly delivered", done: data.per_delivered > 0, meta: `${data.per_delivered}%` },
        { label: "Delivered", done: data.per_delivered === 100, meta: data.per_delivered === 100 ? "Complete" : "pending" },
        { label: "Billed", done: data.per_billed === 100, meta: data.per_billed === 100 ? "Complete" : `${data.per_billed}%` },
      ]
    : [];

  const sections: DetailSection[] = data
    ? [
        {
          heading: "Items",
          fields: [
            {
              label: "Items",
              wide: true,
              bare: true,
              value: (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Delivered</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((l) => (
                      <TableRow key={l.name}>
                        <TableCell>
                          <div className="font-medium tracking-[-.012em] text-ink">{l.item_name}</div>
                          <div className="mt-0.5 text-[11.5px] tabular-nums text-ash-2">
                            {l.item_code} · {l.warehouse}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{l.qty}</TableCell>
                        <TableCell className="text-right tabular-nums text-slate">
                          {l.delivered_qty} / {l.qty}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-2">{formatCurrency(l.rate, data.currency)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(l.amount, data.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ),
            },
          ],
        },
        {
          heading: "Payment schedule",
          fields:
            data.payment_schedule?.length > 0
              ? data.payment_schedule.map((s) => ({
                  label: s.payment_term || "Instalment",
                  value: (
                    <span>
                      {formatCurrency(s.payment_amount, data.currency)}
                      <span className="ml-1.5 font-normal text-ash-2">due {formatDate(s.due_date)}</span>
                    </span>
                  ),
                }))
              : [{ label: "Payment schedule", value: "No payment schedule on this order." }],
        },
        {
          heading: "Totals",
          fields: [
            { label: "Total qty", value: data.total_qty },
            { label: "Total", value: formatCurrency(data.total, data.currency) },
            { label: "Taxes & charges", value: formatCurrency(data.total_taxes_and_charges, data.currency) },
            { label: "Grand total", value: formatCurrency(data.grand_total, data.currency) },
            { label: "Advance paid", value: formatCurrency(data.advance_paid, data.currency) },
            { label: "Outstanding", value: formatCurrency(data.grand_total - data.advance_paid, data.currency) },
          ],
        },
        {
          heading: "Customer",
          fields: [
            {
              label: "Customer",
              wide: true,
              bare: true,
              value: (
                <div className="flex items-center gap-[11px]">
                  <span className="flex size-[38px] flex-none items-center justify-center rounded-full bg-navy text-[12.5px] font-semibold text-white">
                    {initials(data.customer_name)}
                  </span>
                  <div className="min-w-0">
                    <Link
                      to={`/customers/${encodeURIComponent(data.customer)}`}
                      className="text-[13.5px] font-semibold tracking-[-.014em] text-navy hover:underline hover:decoration-blue hover:decoration-2 hover:underline-offset-[3px]"
                    >
                      {data.customer_name}
                    </Link>
                    <div className="mt-0.5 text-[11.5px] text-ash-2">{data.territory}</div>
                  </div>
                </div>
              ),
            },
            { label: "Shipping address", value: data.shipping_address_display || "—", wide: true },
            {
              label: "Contact",
              value: [data.contact_display, data.contact_email, data.contact_mobile].filter(Boolean).join(" · ") || "—",
              wide: true,
            },
          ],
        },
        {
          heading: "More detail",
          fields: [
            { label: "Order type", value: data.order_type },
            { label: "Company", value: data.company },
            { label: "Currency", value: data.currency },
            { label: "Price list", value: data.selling_price_list },
            { label: "Territory", value: data.territory },
            { label: "PO No.", value: data.po_no ?? "—" },
            { label: "Created by", value: data.owner },
          ],
        },
      ]
    : [];

  return (
    <DetailView
      title={data?.name ?? "Loading…"}
      subtitle={data && `${data.customer_name} · Ordered ${formatDate(data.transaction_date)}${data.delivery_date ? ` · Deliver by ${formatDate(data.delivery_date)}` : ""}`}
      backHref="/sales-orders"
      backLabel="Sales Order"
      isLoading={isLoading}
      error={error}
      sections={sections}
      actions={
        data && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusTone(data.status)}>{data.status}</Badge>
            <Badge variant="outline" className="uppercase tracking-[.05em]">
              {DOCSTATUS_LABEL[data.docstatus]}
            </Badge>
            <Button variant="outline" className="h-9 gap-[7px] text-[13px]">
              <Printer className="size-[15px] text-slate" />
              Print
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="h-9 border-[#E7C4C4] text-[13px] text-danger-fg hover:bg-danger-bg" disabled={data.docstatus !== 1}>
                  Cancel order
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel {data.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cancelling reverses reserved stock on {data.items.length} line{data.items.length === 1 ? "" : "s"} and voids the
                    linked payment schedule. The order stays visible with status Cancelled and cannot be amended — you would need to
                    create a fresh order.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep order</AlertDialogCancel>
                  {/* Read-only pass: no mutation is wired here yet - confirming just closes the dialog. */}
                  <AlertDialogAction className="bg-danger-fg text-white hover:bg-danger-hover">Cancel order</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button className="h-9 text-[13px] tracking-[.09em] uppercase">Create delivery note</Button>
          </div>
        )
      }
    >
      {data && (
        <div className="flex items-start justify-between gap-2 rounded-[10px] border border-line-subtle bg-background px-[22px] py-[18px]">
          {steps.map((s, i) => (
            <div key={s.label} className="flex min-w-0 flex-1 flex-col items-start">
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    "flex size-5 flex-none items-center justify-center rounded-full border-2 text-white",
                    s.done ? "border-navy bg-navy" : "border-line-dashed bg-white",
                  )}
                >
                  {s.done && <Check className="size-[11px]" strokeWidth={3} />}
                </span>
                {i < steps.length - 1 && (
                  <span className={cn("mx-1.5 h-0.5 flex-1", steps[i + 1]?.done ? "bg-navy" : "bg-line-subtle")} />
                )}
              </div>
              <div className="mt-[9px] truncate text-[12.5px] font-medium tracking-[-.008em] text-ink">{s.label}</div>
              <div className="mt-0.5 truncate text-[11.5px] tabular-nums text-ash-2">{s.meta}</div>
            </div>
          ))}
        </div>
      )}
    </DetailView>
  );
}
