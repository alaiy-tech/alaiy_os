import {
  ArrowUpRight,
  DollarSign,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Users,
} from "lucide-react";

import type { Period } from "@/components/list/period";
import { StatCard } from "@/components/os/stat-card";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/primitive/card";
import { formatCurrency } from "@/lib/utils";
import type { DashboardOverview, SalesTrend } from "@/types/dashboard";

import { AuditDelta, PeriodDelta, UNAVAILABLE } from "./kpi-deltas";
import { SalesOverviewChart } from "./sales-overview-chart";

/** Pure presentational Server Component - `overview`/`trend` are fetched
 * server-side in page.tsx (see dashboard-stats.server.ts) and handed down
 * already resolved, so only the chart underneath needs a client boundary.
 * `defaultCurrency` is the org's default currency, resolved by the caller. */
export function KpiStrip({
  overview,
  trend,
  period,
  defaultCurrency,
}: {
  overview: DashboardOverview | null;
  trend: SalesTrend | null;
  period: Period;
  defaultCurrency?: string;
}) {
  if (!overview) {
    return (
      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10 xl:col-span-12">
        <p className="text-muted-foreground text-sm">
          Could not load the dashboard overview. Make sure you&apos;re signed in
          and try again.
        </p>
      </div>
    );
  }

  const formatMoney = (value: number) =>
    formatCurrency(value, { currency: defaultCurrency });
  const formatCount = (value: number) => Math.round(value).toLocaleString();

  return (
    <div className="h-full overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 xl:col-span-12">
      <div>
        <div className="grid grid-cols-1 xl:grid-cols-12">
          <div className="grid grid-cols-1 md:grid-cols-2 md:grid-rows-3 xl:col-span-5 xl:border-r">
            <StatCard
              label="Total Sales"
              className="border-b md:border-r"
              icon={<DollarSign className="size-3 text-foreground" />}
              value={formatMoney(overview.total_sales.current)}
              delta={
                <PeriodDelta
                  comparison={overview.total_sales}
                  period={period}
                />
              }
            />

            <StatCard
              label="Total Orders"
              className="border-b"
              icon={<ShoppingBag className="size-3 text-foreground" />}
              value={formatCount(overview.total_orders.current)}
              delta={
                <PeriodDelta
                  comparison={overview.total_orders}
                  period={period}
                />
              }
            />

            <StatCard
              label="Customer Growth"
              className="border-b md:border-r"
              icon={<Users className="size-3 text-foreground" />}
              value={formatCount(overview.customer_growth.current)}
              delta={
                <PeriodDelta
                  comparison={overview.customer_growth}
                  period={period}
                />
              }
            />

            <StatCard
              label="Average Order"
              className="border-b"
              icon={<ReceiptText className="size-3 text-foreground" />}
              value={formatMoney(overview.average_order.current)}
              delta={
                <PeriodDelta
                  comparison={overview.average_order}
                  period={period}
                />
              }
            />

            <StatCard
              label="Return Requests"
              className="border-b md:border-r md:border-b-0"
              icon={<RotateCcw className="size-3 text-foreground" />}
              value={
                overview.return_requests
                  ? formatCount(overview.return_requests.current)
                  : "—"
              }
              delta={
                overview.return_requests ? (
                  <PeriodDelta
                    comparison={overview.return_requests}
                    period={period}
                    higherIsBetter={false}
                  />
                ) : (
                  UNAVAILABLE
                )
              }
            />

            <StatCard
              label="Stock Accuracy"
              icon={<PackageCheck className="size-3 text-foreground" />}
              value={
                overview.stock_accuracy
                  ? `${overview.stock_accuracy.current.toFixed(0)}%`
                  : "—"
              }
              delta={
                overview.stock_accuracy ? (
                  <AuditDelta accuracy={overview.stock_accuracy} />
                ) : (
                  <span className="text-muted-foreground">
                    No stock audits yet
                  </span>
                )
              }
            />
          </div>

          <Card className="h-full rounded-none border-0 ring-0 xl:col-span-7">
            <CardHeader>
              <CardTitle className="font-normal">Sales Overview</CardTitle>
              <CardAction>
                <ArrowUpRight className="size-4" />
              </CardAction>
            </CardHeader>

            <CardContent>
              <SalesOverviewChart
                points={trend?.points ?? []}
                defaultCurrency={defaultCurrency}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
