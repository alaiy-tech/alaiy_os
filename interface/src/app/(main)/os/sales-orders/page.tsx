import { PageHeader } from "@/components/layout/page-header";
import { readPeriod } from "@/components/list/period";
import { PeriodToggle } from "@/components/list/period-toggle";
import { getSalesOrdersOverviewServer } from "@/lib/frappe/sales-order-stats.server";

import { SalesOrderKpiCards } from "./_components/sales-order-kpi-cards";
import { SalesOrders } from "./_components/sales-orders";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = readPeriod(await searchParams);
  const overview = await getSalesOrdersOverviewServer(period);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sales Orders"
        subtitle="Track order volume, value, and cancellations across your sales cycle."
        action={<PeriodToggle />}
      />
      <SalesOrderKpiCards overview={overview} period={period} />
      <SalesOrders />
    </div>
  );
}
