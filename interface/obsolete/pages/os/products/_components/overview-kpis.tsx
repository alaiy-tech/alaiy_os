"use client";

import { useEffect, useState } from "react";

import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/primitive/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/primitive/card";
import { Skeleton } from "@/components/primitive/skeleton";
import { getProductsOverview } from "@/lib/frappe/item-stats";
import { cn } from "@/lib/utils";
// item-stats re-exported none of these; they live with the other shared list and
// product types, and `SalesPeriod` is the same set of windows as `Period`.
import type { PeriodComparison, Period as SalesPeriod } from "@/types/list";
import type { ProductsOverview } from "@/types/products";

const PERIODS: SalesPeriod[] = ["1D", "1W", "1M", "1Y"];
const PERIOD_LABEL: Record<SalesPeriod, string> = {
  "1D": "day",
  "1W": "week",
  "1M": "month",
  "1Y": "year",
};

function PeriodToggle({
  period,
  onChange,
}: {
  period: SalesPeriod;
  onChange: (p: SalesPeriod) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "rounded px-2 py-0.5 text-xs font-medium transition-colors",
            p === period
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function KpiCard({
  label,
  comparison,
  period,
  className,
  format,
}: {
  label: string;
  comparison: PeriodComparison | null;
  period: SalesPeriod;
  className?: string;
  format: (value: number) => string;
}) {
  if (!comparison) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardAction>
            <ArrowUpRight className="size-4" />
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  const { current, previous } = comparison;
  const diff = current - previous;
  const pct = pctChange(current, previous);
  const isUp = diff >= 0;

  return (
    <Card className={cn("rounded-none", className)}>
      <CardHeader>
        <span className="text-base font-normal">{label}</span>
        <CardDescription />
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none tracking-tight">
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
        <p className="text-xs">
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

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OverviewKpis() {
  const [period, setPeriod] = useState<SalesPeriod>("1M");
  const [overview, setOverview] = useState<ProductsOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOverview(null);
    getProductsOverview(period)
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <section className="space-y-4 -mt-2">
      <div className="flex flex-col items-end gap-2">
        <PeriodToggle period={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Units Sold"
          comparison={overview?.units_sold ?? null}
          period={period}
          className="rounded-none rounded-l-xl"
          format={formatUnits}
        />
        <KpiCard
          label="On-Hand Units"
          comparison={overview?.on_hand_units ?? null}
          period={period}
          format={formatUnits}
        />
        <KpiCard
          label="Average Unit Value"
          comparison={overview?.average_unit_value ?? null}
          period={period}
          format={formatCurrency}
        />
        <KpiCard
          label="Active SKUs"
          comparison={overview?.active_skus ?? null}
          period={period}
          className="rounded-none rounded-r-xl"
          format={formatUnits}
        />
      </div>
    </section>
  );
}
