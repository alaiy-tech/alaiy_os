import type { ReactNode } from "react";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { KPI_ICONS } from "@/config/kpi-icons";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils";
import type {
  OsKpiFormat,
  OsKpiIconName,
  OsKpiTrendPolarity,
  OsKpiTrendUnit,
} from "@/types/kpi";

import { StatCard } from "../derived/stat-card";
import React from "react";

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

function normalizeNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** A safe period-over-period percent change: `null` (not a plain `0`) when
 * there's genuinely nothing to compare against - a missing/undecided
 * `previousValue`, or `0` itself, which would make the percentage
 * meaningless (divide-by-zero) rather than merely large. A non-numeric
 * `value` (an already-formatted string from the Data Source, per
 * `formatValue`'s own doc comment) can't be compared either. */
function computeTrend(
  value: number | string,
  previousValue: number | string | null | undefined,
): number | null {
  if (typeof value !== "number") return null;
  const previous = normalizeNumber(previousValue);
  if (previous === null || previous === 0) return null;
  return ((value - previous) / previous) * 100;
}

/** The badge shown next to the value - green/destructive per whether the
 * movement is good news (`trendPolarity` flips this for metrics like Return
 * Requests, where a rising count is bad), grey when unchanged (a rise or
 * fall is never "good" or "bad" at exactly 0). `null` (no comparison
 * available) renders nothing here; `TrendSummary` below carries that state
 * instead. */
function TrendBadge({
  trend,
  trendUnit = "percent",
  trendPolarity = "positive",
}: {
  trend: number | string | null | undefined;
  trendUnit?: OsKpiTrendUnit;
  trendPolarity?: OsKpiTrendPolarity;
}) {
  const normalizedTrend = normalizeNumber(trend);

  const suffix = trendUnit === "points" ? " pts" : "%";

  if (normalizedTrend === 0 || normalizedTrend === null) {
    return (
      <span className="flex flex-row items-center gap-0.5 text-muted-foreground">
        <Minus size={16} />
        {`0${suffix}`}
      </span>
    );
  }

  const isUp = normalizedTrend > 0;
  const isGood = isUp === (trendPolarity === "positive");
  const TrendIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        isGood ? "text-success-foreground" : "text-caution-foreground",
        "flex flex-row gap-0.5 items-center",
      )}
    >
      <TrendIcon size={16} />
      {isUp ? "+" : ""}
      {normalizedTrend.toFixed(1)}
      {suffix}
    </span>
  );
}

/**
 * The `os-kpi` registry entry - fully generic across every page. `title`,
 * `icon`, `format`/`currency`/`precision`, `trendUnit`/`trendPolarity`/
 * `trendLabel`, are presentation config (`props`, editable
 * via `UPDATE_COMPONENT`); `value`/`trend`/`previousValue` are raw
 * already-fetched numbers (or a pre-formatted string for `value`), resolved
 * from a Data Source Registry source (see `runtime/data/`). A source can
 * either hand over an already-computed delta directly (`trend`) or the two
 * raw numbers being compared (`value`+`previousValue`) and let this
 * component do the (safe, divide-by-zero-aware) percent-change math itself
 * - `computeTrend` above - since that's generic period-over-period
 * arithmetic, not metric-specific.
 */
export function OsKpi({
  title,
  subtitle,
  icon,
  value,
  format,
  currency,
  precision,
  trend,
  previousValue,
  trendUnit,
  trendPolarity,
  trendLabel,
  className,
}: {
  title: string;
  subtitle: string;
  icon?: OsKpiIconName;
  value: number | string;
  format?: OsKpiFormat;
  currency?: string;
  precision?: number;
  trend?: number | null;
  /** The prior period's raw value for the same metric - ignored when
   * `trend` is given directly. */
  previousValue?: number | string | null;
  trendUnit?: OsKpiTrendUnit;
  trendPolarity?: OsKpiTrendPolarity;
  trendLabel?: string;
  className: string;
}): ReactNode {
  const Icon = (icon && KPI_ICONS[icon]) || KPI_ICONS.DollarSign;
  const effectiveTrend = trend ?? computeTrend(value, previousValue);

  return (
    <StatCard
      title={title}
      subtitle={subtitle}
      icon={<Icon className="size-3.5 text-foreground" />}
      value={formatValue(value, format, precision, currency)}
      delta={
        <TrendBadge
          trend={effectiveTrend}
          trendUnit={trendUnit}
          trendPolarity={trendPolarity}
        />
      }
      summary={trendLabel}
      className={className}
    />
  );
}
