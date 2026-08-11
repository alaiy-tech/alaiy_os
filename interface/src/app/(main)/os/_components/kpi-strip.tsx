import { ArrowUpRight, DollarSign, PackageCheck, ReceiptText, RotateCcw, ShoppingBag, Users } from "lucide-react";

import { PERIOD_LABEL, type Period } from "@/components/list/period";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { DashboardOverview, SalesTrend, StockAccuracy } from "@/types/dashboard";
import type { PeriodComparison } from "@/types/list";

import { SalesOverviewChart } from "./sales-overview-chart";

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function StatCard({
  label,
  icon,
  value,
  delta,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  delta: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("h-full rounded-none border-0 border-border ring-0", className)}>
      <CardHeader>
        <CardTitle className="font-normal text-sm">{label}</CardTitle>
        <CardDescription className="text-3xl text-foreground tabular-nums leading-none tracking-tight">
          {value}
        </CardDescription>
        <CardAction className="grid size-6 place-items-center rounded-sm bg-muted">{icon}</CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-sm">{delta}</div>
      </CardContent>
    </Card>
  );
}

/** The period-over-period line under a figure. `higherIsBetter` flips the
 * colour for metrics where growth is bad (returns), so a rising return count
 * never reads as green. */
function PeriodDelta({
  comparison,
  period,
  higherIsBetter = true,
}: {
  comparison: PeriodComparison;
  period: Period;
  higherIsBetter?: boolean;
}) {
  const isUp = comparison.current - comparison.previous >= 0;
  const isGood = isUp === higherIsBetter;

  return (
    <>
      <span className={isGood ? "text-green-700 dark:text-green-300" : "text-destructive"}>
        {formatPct(pctChange(comparison.current, comparison.previous))}
      </span>
      <span className="text-muted-foreground"> vs last {PERIOD_LABEL[period]}</span>
    </>
  );
}

/** Stock accuracy is quoted in percentage points, not as a percentage change of
 * a percentage - "+2.4 pts" is what an ops lead reads; "+2.5%" of 96% is not. */
function AuditDelta({ accuracy }: { accuracy: StockAccuracy }) {
  if (accuracy.previous === null) {
    return <span className="text-muted-foreground">First recorded audit</span>;
  }

  const diff = accuracy.current - accuracy.previous;

  return (
    <>
      <span className={diff >= 0 ? "text-green-700 dark:text-green-300" : "text-destructive"}>
        {diff >= 0 ? "+" : ""}
        {diff.toFixed(1)} pts
      </span>
      <span className="text-muted-foreground"> vs last audit</span>
    </>
  );
}

const UNAVAILABLE = <span className="text-muted-foreground">Not available</span>;

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
          Could not load the dashboard overview. Make sure you&apos;re signed in and try again.
        </p>
      </div>
    );
  }

  const formatMoney = (value: number) => formatCurrency(value, { currency: defaultCurrency });
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
              delta={<PeriodDelta comparison={overview.total_sales} period={period} />}
            />

            <StatCard
              label="Total Orders"
              className="border-b"
              icon={<ShoppingBag className="size-3 text-foreground" />}
              value={formatCount(overview.total_orders.current)}
              delta={<PeriodDelta comparison={overview.total_orders} period={period} />}
            />

            <StatCard
              label="Customer Growth"
              className="border-b md:border-r"
              icon={<Users className="size-3 text-foreground" />}
              value={formatCount(overview.customer_growth.current)}
              delta={<PeriodDelta comparison={overview.customer_growth} period={period} />}
            />

            <StatCard
              label="Average Order"
              className="border-b"
              icon={<ReceiptText className="size-3 text-foreground" />}
              value={formatMoney(overview.average_order.current)}
              delta={<PeriodDelta comparison={overview.average_order} period={period} />}
            />

            <StatCard
              label="Return Requests"
              className="border-b md:border-r md:border-b-0"
              icon={<RotateCcw className="size-3 text-foreground" />}
              value={overview.return_requests ? formatCount(overview.return_requests.current) : "—"}
              delta={
                overview.return_requests ? (
                  <PeriodDelta comparison={overview.return_requests} period={period} higherIsBetter={false} />
                ) : (
                  UNAVAILABLE
                )
              }
            />

            <StatCard
              label="Stock Accuracy"
              icon={<PackageCheck className="size-3 text-foreground" />}
              value={overview.stock_accuracy ? `${overview.stock_accuracy.current.toFixed(0)}%` : "—"}
              delta={
                overview.stock_accuracy ? (
                  <AuditDelta accuracy={overview.stock_accuracy} />
                ) : (
                  <span className="text-muted-foreground">No stock audits yet</span>
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
              <SalesOverviewChart points={trend?.points ?? []} defaultCurrency={defaultCurrency} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
