import type { ReactNode } from "react";

import { TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/primitive/badge";
import { KPI_ICONS } from "@/config/kpi-icons";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  OsKpiBorderTone,
  OsKpiFormat,
  OsKpiIconName,
  OsKpiTrendPolarity,
  OsKpiTrendUnit,
} from "@/types/kpi";

import { StatCard } from "./stat-card";

/** Auto-typecasts a raw value into display text: a string from the Data
 * Source passes through unchanged, a number is formatted per `format`. This
 * is what makes `value` a text-typed prop at the registry contract level
 * (see `types/kpi.ts`) while still accepting a plain number from a source's
 * `resolve()` without every source having to pre-format it itself. */
function formatValue(
  value: number | string,
  format: OsKpiFormat | undefined,
  precision: number | undefined,
  currency: string | undefined,
): string {
  if (typeof value === "string") return value;

  if (format === "currency") {
    return formatCurrency(value, {
      currency,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }
  if (format === "percent") return `${value?.toFixed(precision ?? 0)}%`;
  return precision !== undefined
    ? value.toFixed(precision)
    : Math.round(value).toLocaleString();
}

/** The badge shown next to the value - green/destructive per whether the
 * movement is good news (`trendPolarity` flips this for metrics like Return
 * Requests, where a rising count is bad). `null` (no comparison available)
 * renders nothing here; `TrendSummary` below carries that state instead. */
function TrendBadge({
  trend,
  trendUnit = "percent",
  trendPolarity = "positive",
}: {
  trend: number | undefined | null;
  trendUnit?: OsKpiTrendUnit;
  trendPolarity?: OsKpiTrendPolarity;
}) {
  if (trend === undefined || trend === null) return null;

  const isUp = trend >= 0;
  const isGood = isUp === (trendPolarity === "positive");
  const suffix = trendUnit === "points" ? " pts" : "%";
  const TrendIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <Badge
      variant="outline"
      className={cn(
        isGood
          ? "border-success/20 bg-success/10 text-success-foreground dark:border-success/40 dark:bg-success/15"
          : "border-destructive/20 bg-destructive/10 text-destructive",
      )}
    >
      <TrendIcon />
      {isUp ? "+" : ""}
      {trend.toFixed(1)}
      {suffix}
    </Badge>
  );
}

/** The summary line at the card's bottom - the delta badge's caption, once
 * the badge itself moved up next to the value. */
function TrendSummary({
  trend,
  trendLabel,
}: {
  trend: number | undefined | null;
  trendLabel?: string;
}) {
  if (trend === undefined || trend === null) {
    return (
      <span className="text-muted-foreground">No comparison available</span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {trendLabel ?? "vs last period"}
    </span>
  );
}

/**
 * The `os-kpi` registry entry - fully generic across every page. `title`,
 * `icon`, `format`/`currency`/`precision`, `trendUnit`/`trendPolarity`/
 * `trendLabel`, and `borderTone` are presentation config (`props`, editable
 * via `UPDATE_COMPONENT`); `value`/`trend` are the raw already-fetched
 * number (or a pre-formatted string) and an already-computed delta,
 * resolved from a Data Source Registry source (see `runtime/data/`). No
 * metric-specific math lives here at all - a data source's `resolve()` is
 * the only place a period comparison ever gets turned into a plain delta
 * number.
 */
export function OsKpi({
  title,
  icon,
  value,
  format,
  currency,
  precision,
  trend,
  trendUnit,
  trendPolarity,
  trendLabel,
  borderTone,
}: {
  title: string;
  icon?: OsKpiIconName;
  value: number | string;
  format?: OsKpiFormat;
  currency?: string;
  precision?: number;
  trend?: number | null;
  trendUnit?: OsKpiTrendUnit;
  trendPolarity?: OsKpiTrendPolarity;
  trendLabel?: string;
  borderTone?: OsKpiBorderTone;
}): ReactNode {
  const Icon = (icon && KPI_ICONS[icon]) || KPI_ICONS.DollarSign;

  return (
    <StatCard
      label={title}
      icon={<Icon className="size-3 text-foreground" />}
      value={formatValue(value, format, precision, currency)}
      delta={
        <TrendBadge
          trend={trend}
          trendUnit={trendUnit}
          trendPolarity={trendPolarity}
        />
      }
      summary={<TrendSummary trend={trend} trendLabel={trendLabel} />}
      borderTone={borderTone}
    />
  );
}
