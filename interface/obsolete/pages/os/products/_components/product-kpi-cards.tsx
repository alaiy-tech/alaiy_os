import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

import { PERIOD_LABEL, type Period } from "@/components/list/period";
import { Badge } from "@/components/primitive/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/primitive/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { PeriodComparison } from "@/types/list";
import type { ProductsOverview } from "@/types/products";

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
          <span className="text-2xl leading-none tracking-tight">
            {format(current)}
          </span>

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
          <span className="font-medium text-foreground">
            {format(Math.abs(diff))}
          </span>{" "}
          <span className="text-muted-foreground">
            {isUp ? "more" : "less"} than last {PERIOD_LABEL[period]}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

function formatUnits(value: number): string {
  return `${Math.round(value).toLocaleString()} Units`;
}

/** Pure presentational Server Component - the overview is fetched
 * server-side in page.tsx (see item-stats.server.ts) and handed down already
 * resolved, so this never needs "use client" or a loading state of its own.
 * `defaultCurrency` is the org's default currency (see
 * useCompany()/getCompanyInfo()), resolved server-side by the caller page. */
export function ProductKpiCards({
  overview,
  period,
  defaultCurrency,
}: {
  overview: ProductsOverview | null;
  period: Period;
  defaultCurrency?: string;
}) {
  if (!overview) {
    return (
      <p className="text-muted-foreground text-sm">
        Could not load the products overview. Make sure you&apos;re signed in
        and try again.
      </p>
    );
  }

  const formatMoney = (value: number) =>
    formatCurrency(value, { currency: defaultCurrency });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Units Sold"
        comparison={overview.units_sold}
        period={period}
        format={formatUnits}
      />
      <KpiCard
        label="On-Hand Units"
        comparison={overview.on_hand_units}
        period={period}
        format={formatUnits}
      />
      <KpiCard
        label="Average Unit Value"
        comparison={overview.average_unit_value}
        period={period}
        format={formatMoney}
      />
      <KpiCard
        label="Active SKUs"
        comparison={overview.active_skus}
        period={period}
        format={formatUnits}
      />
    </div>
  );
}
