"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/primitive/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/primitive/card";
import { Skeleton } from "@/components/primitive/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { useCompany } from "@/stores/company/company-provider";
import type {
  SalesOrdersSummary,
  SummaryComparison,
} from "@/types/sales-orders";

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function KpiCard({
  label,
  comparison,
  format,
  /** Inverts the trend colouring: more past-due deliveries is bad news. */
  lowerIsBetter = false,
  icon,
}: {
  readonly label: string;
  readonly comparison: SummaryComparison;
  readonly format: (value: number) => string;
  readonly lowerIsBetter?: boolean;
  readonly icon?: React.ReactNode;
}) {
  const { current, previous } = comparison;

  // No date range picked means no comparable preceding window, so the card
  // shows the figure alone rather than a trend against a made-up baseline.
  const hasComparison = previous !== null;
  const diff = hasComparison ? current - previous : 0;
  const isUp = diff >= 0;
  const isGood = lowerIsBetter ? !isUp : isUp;

  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardAction>{icon ?? <ArrowUpRight className="size-4" />}</CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none tracking-tight">
            {format(current)}
          </span>

          {hasComparison && (
            <Badge
              variant="outline"
              className={cn(
                isGood
                  ? "border-green-200 bg-green-500/10 text-green-700 dark:border-green-900/40 dark:bg-green-500/15 dark:text-green-300"
                  : "border-destructive/20 bg-destructive/10 text-destructive",
              )}
            >
              {isUp ? <TrendingUp /> : <TrendingDown />}
              {isUp ? "+" : ""}
              {pctChange(current, previous).toFixed(1)}%
            </Badge>
          )}
        </div>
        <p className="text-sm">
          {hasComparison ? (
            <>
              <span className="font-medium text-foreground">
                {format(Math.abs(diff))}
              </span>{" "}
              <span className="text-muted-foreground">
                {isUp ? "more" : "less"} than the previous period
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Pick a date range to compare
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString();
}

/** The KPI strip above the Sales Orders table. Client-side because every
 * figure tracks the list's own filters — status tab, date range, customer and
 * search — and re-fetches whenever they change. */
export function SalesOrderKpiCards({
  summary,
  isLoading,
  hasFailed,
}: {
  readonly summary: SalesOrdersSummary | null;
  readonly isLoading: boolean;
  readonly hasFailed: boolean;
}) {
  const { defaultCurrency } = useCompany();
  const formatMoney = (value: number) =>
    formatCurrency(value, { currency: defaultCurrency });

  if (hasFailed) {
    return (
      <p className="text-muted-foreground text-sm">
        Could not load the sales orders summary. Make sure you&apos;re signed in
        and try again.
      </p>
    );
  }

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((card) => (
          <Skeleton key={card} className="h-[122px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Orders"
        comparison={summary.total_orders}
        format={formatCount}
      />
      <KpiCard
        label="Total GMV"
        comparison={summary.total_gmv}
        format={formatMoney}
      />
      <KpiCard
        label="Avg Order Value"
        comparison={summary.average_order_value}
        format={formatMoney}
      />
      <KpiCard
        label="Past-due Deliveries"
        comparison={summary.past_due_deliveries}
        format={formatCount}
        lowerIsBetter
        icon={<AlertTriangle className="size-4" />}
      />
    </div>
  );
}
