import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SALES_ORDER_BASE_PATH, salesOrderHref } from "@/constants/sales-orders";
import { getSalesOrderDetailServer } from "@/lib/frappe/sales-order-detail.server";
import { getCompanyInfo } from "@/lib/frappe/server";

import { DeliveryNotes, SalesInvoices } from "./_components/linked-documents";
import { OrderActions } from "./_components/order-actions";
import { OrderLines } from "./_components/order-lines";
import { OrderSummary } from "./_components/order-summary";
import { OrderTotals } from "./_components/order-totals";
import { PaymentSchedule } from "./_components/payment-schedule";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const name = decodeURIComponent(id);

  const [detail, company] = await Promise.all([getSalesOrderDetailServer(name), getCompanyInfo()]);
  if (!detail) notFound();

  // The order's own currency wins over the company default: an order taken in
  // a customer's currency holds its amounts in that currency, and relabelling
  // them with the company's would misstate every figure here.
  const currency = detail.order.currency ?? company?.defaultCurrency ?? undefined;

  const cancelled = detail.order.docstatus === 2;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={detail.order.name}
        subtitle="Sales Order"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <OrderActions name={detail.order.name} docstatus={detail.order.docstatus} />
            <Button asChild variant="outline" size="sm">
              <Link href={SALES_ORDER_BASE_PATH}>
                <ArrowLeft /> All Sales Orders
              </Link>
            </Button>
          </div>
        }
      />

      {cancelled && (
        <Alert variant="destructive">
          <AlertTitle>This order was cancelled.</AlertTitle>
          <AlertDescription>
            It no longer counts toward delivery or billing. Amend it to carry the same lines into a fresh draft.
          </AlertDescription>
        </Alert>
      )}

      {/* An amended order is a replacement for one that was cancelled, and the
          link back is the only thing on the page that says so. */}
      {detail.order.amended_from && (
        <Alert>
          <AlertTitle>Amended from {detail.order.amended_from}</AlertTitle>
          <AlertDescription>
            <Link href={salesOrderHref(detail.order.amended_from)} className="underline underline-offset-4">
              Open the order this one replaces
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <OrderSummary
            order={detail.order}
            deliveryNoteCount={detail.delivery_notes.length}
            invoiceCount={detail.invoices.length}
          />
        </div>
        <div className="xl:col-span-4">
          <OrderTotals totals={detail.totals} taxes={detail.taxes} currency={currency} />
        </div>
      </div>

      <OrderLines items={detail.items} currency={currency} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DeliveryNotes notes={detail.delivery_notes} currency={currency} />
        <SalesInvoices invoices={detail.invoices} currency={currency} />
      </div>

      <PaymentSchedule terms={detail.payment_schedule} currency={currency} />
    </div>
  );
}
