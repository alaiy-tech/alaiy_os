import { PageHeader } from "@/components/layout/page-header";
import { readPeriod } from "@/components/list/period";
import { PeriodToggle } from "@/components/list/period-toggle";
import { getProductsOverviewServer } from "@/lib/frappe/item-stats.server";

import { ProductKpiCards } from "./_components/product-kpi-cards";
import Products from "./_components/products";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = readPeriod(await searchParams);
  const overview = await getProductsOverviewServer(period);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Products"
        subtitle="Track units sold, stock levels, and catalog health across your product line."
        action={<PeriodToggle />}
      />
      <ProductKpiCards overview={overview} period={period} />
      <div>
        <Products />
      </div>
    </div>
  );
}
