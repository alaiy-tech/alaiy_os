import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PURCHASE_ORDER_BASE_PATH } from "@/constants/purchase-orders";
import { getPurchaseOrderDetailServer } from "@/lib/frappe/purchase-order-detail.server";
import { getCompanyInfo } from "@/lib/frappe/server";

import { LinkedInvoices, LinkedReceipts } from "./_components/linked-documents";
import { OrderLines } from "./_components/order-lines";
import { OrderSummary } from "./_components/order-summary";
import { OrderTotals } from "./_components/order-totals";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const name = decodeURIComponent(id);

  const [detail, company] = await Promise.all([getPurchaseOrderDetailServer(name), getCompanyInfo()]);
  if (!detail) notFound();

  // The order's own currency wins over the company default: a PO raised on a
  // foreign supplier holds its amounts in that supplier's currency, and
  // relabelling them with the company's would misstate every figure here.
  const currency = detail.order.currency ?? company?.defaultCurrency ?? undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={detail.order.name}
        subtitle="Purchase Order"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={PURCHASE_ORDER_BASE_PATH}>
              <ArrowLeft /> All Purchase Orders
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <OrderSummary order={detail.order} />
        </div>
        <div className="xl:col-span-5">
          <OrderTotals totals={detail.totals} taxes={detail.taxes} currency={currency} />
        </div>
      </div>

      <OrderLines items={detail.items} currency={currency} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <LinkedReceipts receipts={detail.receipts} currency={currency} />
        <LinkedInvoices invoices={detail.invoices} currency={currency} />
      </div>
    </div>
  );
}
