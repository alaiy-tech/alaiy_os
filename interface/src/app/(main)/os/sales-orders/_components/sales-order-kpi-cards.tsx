import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

import { PERIOD_LABEL, type Period } from "@/components/list/period";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { PeriodComparison } from "@/types/list";
import type { SalesOrdersOverview } from "@/types/sales-orders";

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function KpiCard({
  label,
  comparison,
  period,
  format,
}: {
  label: string;
  comparison: PeriodComparison;
  period: Period;
  format: (value: number) => string;
}) {
  const { current, previous } = comparison;
  const diff = current - previous;
  const pct = pctChange(current, previous);
  const isUp = diff >= 0;

  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none tracking-tight">{format(current)}</span>

          <Badge
            variant="outline"
            className={cn(
              isUp
                ? "border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300"
                : "border-destructive/20 bg-destructive/10 text-destructive",
            )}
          >
            {isUp ? <TrendingUp /> : <TrendingDown />}
            {isUp ? "+" : ""}
            {pct.toFixed(1)}%
          </Badge>
        </div>
        <p className="text-sm">
          <span className="font-medium text-foreground">{format(Math.abs(diff))}</span>{" "}
          <span className="text-muted-foreground">
            {isUp ? "more" : "less"} than last {PERIOD_LABEL[period]}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString();
}

/** Pure presentational Server Component - see product-kpi-cards.tsx for why
 * this never needs "use client". `defaultCurrency` is the org's default
 * currency (see useCompany()/getCompanyInfo()), resolved server-side by the
 * caller page and threaded down as a prop. */
export function SalesOrderKpiCards({
  overview,
  period,
  defaultCurrency,
}: {
  overview: SalesOrdersOverview | null;
  period: Period;
  defaultCurrency?: string;
}) {
  if (!overview) {
    return (
      <p className="text-muted-foreground text-sm">
        Could not load the sales orders overview. Make sure you&apos;re signed in and try again.
      </p>
    );
  }

  const formatMoney = (value: number) => formatCurrency(value, { currency: defaultCurrency });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Total Orders" comparison={overview.total_orders} period={period} format={formatCount} />
      <KpiCard
        label="Total Order Value"
        comparison={overview.total_order_value}
        period={period}
        format={formatMoney}
      />
      <KpiCard
        label="Average Order Value"
        comparison={overview.average_order_value}
        period={period}
        format={formatMoney}
      />
      <KpiCard
        label="Cancelled/Returned Orders"
        comparison={overview.cancelled_orders}
        period={period}
        format={formatCount}
      />
    </div>
  );
}
