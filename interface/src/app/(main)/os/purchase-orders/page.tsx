import { PageHeader } from "@/components/layout/page-header";
import { readPeriod } from "@/components/list/period";
import { PeriodToggle } from "@/components/list/period-toggle";
import { getPurchaseOrdersOverviewServer } from "@/lib/frappe/purchase-order-stats.server";
import { getCompanyInfo } from "@/lib/frappe/server";

import { PurchaseOrderKpiCards } from "./_components/purchase-order-kpi-cards";
import { PurchaseOrders } from "./_components/purchase-orders";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = readPeriod(await searchParams);
  const [overview, company] = await Promise.all([getPurchaseOrdersOverviewServer(period), getCompanyInfo()]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Purchase Orders"
        subtitle="Track order volume, committed spend, and cancellations across your procurement cycle."
        action={<PeriodToggle />}
      />
      <PurchaseOrderKpiCards
        overview={overview}
        period={period}
        defaultCurrency={company?.defaultCurrency ?? undefined}
      />
      <PurchaseOrders />
    </div>
  );
}
