import { format } from "date-fns";
import { Settings2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { readPeriod } from "@/components/list/period";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  getDashboardOverviewServer,
  getRecentOrdersServer,
  getSalesChannelsServer,
  getSalesTrendServer,
  getTopProductsServer,
} from "@/lib/frappe/dashboard-stats.server";
import { getStockMixServer } from "@/lib/frappe/item-stats.server";
import { getCompanyInfo, getServerUser } from "@/lib/frappe/server";

import { readChannel, toChannelParam } from "./_components/channel";
import { DashboardFilters } from "./_components/dashboard-filters";
import { Inventory } from "./_components/inventory";
import { KpiStrip } from "./_components/kpi-strip";
import { RecentOrders } from "./_components/recent-orders";
import { TopProducts } from "./_components/top-products";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const formattedDate = format(new Date(), "EEEE, do MMMM yyyy");
  const resolvedSearchParams = await searchParams;
  const period = readPeriod(resolvedSearchParams);

  // The channel list has to be resolved before the selected channel can be
  // validated against it, so it can't join the parallel fetch below.
  const [user, company, channels] = await Promise.all([getServerUser(), getCompanyInfo(), getSalesChannelsServer()]);
  const channel = toChannelParam(readChannel(resolvedSearchParams, channels));

  // Stock and recent orders take no period: stock is point-in-time, and
  // "recent" means latest activity rather than activity within the window.
  const [overview, trend, topProducts, stockMix, recentOrders] = await Promise.all([
    getDashboardOverviewServer(period, channel),
    getSalesTrendServer(channel),
    getTopProductsServer(period, channel),
    getStockMixServer(),
    getRecentOrdersServer(channel),
  ]);

  const firstName = user?.fullName.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Welcome, ${firstName}!`}
        subtitle={formattedDate}
        action={
          <div className="flex flex-wrap items-end justify-end gap-2">
            <DashboardFilters channels={channels} />

            <Separator orientation="vertical" />

            <Button size="icon-sm" variant="outline">
              <Settings2 />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <KpiStrip
          overview={overview}
          trend={trend}
          period={period}
          defaultCurrency={company?.defaultCurrency ?? undefined}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <TopProducts overview={topProducts} defaultCurrency={company?.defaultCurrency ?? undefined} />
        </div>

        <div className="xl:col-span-6">
          <Inventory mix={stockMix} />
        </div>
      </div>
      <div className="xl:col-span-12">
        <RecentOrders orders={recentOrders?.orders ?? []} defaultCurrency={company?.defaultCurrency ?? undefined} />
      </div>
    </div>
  );
}
