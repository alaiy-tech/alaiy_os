import { PageHeader } from "@/components/layout/page-header";
import { readPeriod } from "@/components/list/period";
import { PeriodToggle } from "@/components/list/period-toggle";
import { getCustomersServer } from "@/lib/frappe/customer-list.server";
import { getCustomersOverviewServer, getCustomerTrendServer } from "@/lib/frappe/customer-stats.server";
import { getCompanyInfo } from "@/lib/frappe/server";

import { CustomerKpiCards } from "./_components/customer-kpi-cards";
import { CustomerTrend } from "./_components/customer-trend";
import { Customers } from "./_components/customers";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = readPeriod(await searchParams);

  // The trend and the table take no period: the chart is a rolling 12 months
  // (see get_customer_trend) and the table lists the roster, not a window.
  const [overview, trend, list, company] = await Promise.all([
    getCustomersOverviewServer(period),
    getCustomerTrendServer(),
    getCustomersServer(),
    getCompanyInfo(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Customers"
        subtitle="Track acquisition, ordering activity, and spend across your customer base."
        action={<PeriodToggle />}
      />
      <CustomerKpiCards overview={overview} period={period} defaultCurrency={company?.defaultCurrency ?? undefined} />
      <CustomerTrend points={trend} />
      <Customers
        customers={list?.customers ?? []}
        total={list?.total ?? 0}
        defaultCurrency={company?.defaultCurrency ?? undefined}
      />
    </div>
  );
}
