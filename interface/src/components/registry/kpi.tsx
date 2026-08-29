import type { ReactNode } from "react";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/primitive/badge";
import { KPI_ICONS } from "@/config/kpi-icons";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils";
import type {
  OsKpiBorderTone,
  OsKpiFormat,
  OsKpiIconName,
  OsKpiTrendPolarity,
  OsKpiTrendUnit,
} from "@/types/kpi";

import { StatCard } from "../derived/stat-card";

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
  if (normalizedTrend === null) return null;

  const suffix = trendUnit === "points" ? " pts" : "%";

  if (normalizedTrend === 0) {
    return (
      <Badge
        variant="outline"
        className="border-muted-foreground/20 bg-muted text-muted-foreground"
      >
        <Minus />
        {`0${suffix}`}
      </Badge>
    );
  }

  const isUp = normalizedTrend > 0;
  const isGood = isUp === (trendPolarity === "positive");
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
      {normalizedTrend.toFixed(1)}
      {suffix}
    </Badge>
  );
}

/** The summary line at the card's bottom - the delta badge's caption, once
 * the badge itself moved up next to the value. `trendLabel` is just the
 * comparison point's own name (e.g. the active period toggle's option,
 * "1D") - this is what prepends the "vs " every caller would otherwise have
 * to repeat. */
function TrendSummary({
  trend,
  trendLabel,
}: {
  trend: number | string | null | undefined;
  trendLabel?: string;
}) {
  const normalizedTrend = normalizeNumber(trend);

  if (normalizedTrend === null) {
    return (
      <span className="text-muted-foreground">No comparison available</span>
    );
  }

  return (
    <span className="text-muted-foreground">
      vs {trendLabel ?? "last period"}
    </span>
  );
}

/**
 * The `os-kpi` registry entry - fully generic across every page. `title`,
 * `icon`, `format`/`currency`/`precision`, `trendUnit`/`trendPolarity`/
 * `trendLabel`, and `borderTone` are presentation config (`props`, editable
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
  borderTone,
}: {
  title: string;
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
  borderTone?: OsKpiBorderTone;
}): ReactNode {
  const Icon = (icon && KPI_ICONS[icon]) || KPI_ICONS.DollarSign;
  const effectiveTrend = trend ?? computeTrend(value, previousValue);

  return (
    <StatCard
      label={title}
      icon={<Icon className="size-3 text-foreground" />}
      value={formatValue(value, format, precision, currency)}
      delta={
        <TrendBadge
          trend={effectiveTrend}
          trendUnit={trendUnit}
          trendPolarity={trendPolarity}
        />
      }
      summary={
        <TrendSummary trend={effectiveTrend} trendLabel={trendLabel} />
      }
      borderTone={borderTone}
    />
  );
}
