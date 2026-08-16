import type { ReactNode } from "react";

import { PERIOD_LABEL, type Period } from "@/components/list/period";
import { formatCurrency } from "@/lib/utils";
import type { DashboardOverview, StockAccuracy } from "@/types/dashboard";
import type { PeriodComparison } from "@/types/list";

/** Dashboard-specific KPI math and delta rendering - moved out of any
 * runtime component (see Round 2's Stage C/D) so `os-kpi`
 * (`src/components/os/kpi.tsx`) stays fully generic across features. `/os`'s
 * own `kpi-strip.tsx` imports `PeriodDelta`/`AuditDelta`/`UNAVAILABLE` from
 * here too - one implementation, not two. */

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** The period-over-period line under a figure. `higherIsBetter` flips the
 * colour for metrics where growth is bad (returns), so a rising return count
 * never reads as green. */
export function PeriodDelta({
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
export function AuditDelta({ accuracy }: { accuracy: StockAccuracy }) {
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

export const UNAVAILABLE = <span className="text-muted-foreground">Not available</span>;

export type DashboardKpiMetric =
  | "total_sales"
  | "total_orders"
  | "customer_growth"
  | "average_order"
  | "return_requests"
  | "stock_accuracy";

export type ResolvedKpi = { value: string; delta: ReactNode };

/**
 * All 6 dashboard KPIs' metric-specific math: period comparisons, money vs.
 * count vs. percentage-point formatting, and (for `return_requests`) an
 * inverted delta polarity. Exactly what `/os`'s own `kpi-strip.tsx` computes
 * inline per card - pulled out here so the headless dashboard's `os-kpi`
 * nodes only ever bind `value`/`delta`; `title`/`icon` stay in the JSON's
 * `props`, genuinely editable by a future structured UI action.
 */
export function computeDashboardKpi(
  metric: DashboardKpiMetric,
  overview: DashboardOverview | null,
  period: Period,
  defaultCurrency?: string,
): ResolvedKpi {
  if (!overview) return { value: "—", delta: UNAVAILABLE };

  const formatMoney = (value: number) => formatCurrency(value, { currency: defaultCurrency });
  const formatCount = (value: number) => Math.round(value).toLocaleString();

  switch (metric) {
    case "total_sales":
      return {
        value: formatMoney(overview.total_sales.current),
        delta: <PeriodDelta comparison={overview.total_sales} period={period} />,
      };
    case "total_orders":
      return {
        value: formatCount(overview.total_orders.current),
        delta: <PeriodDelta comparison={overview.total_orders} period={period} />,
      };
    case "customer_growth":
      return {
        value: formatCount(overview.customer_growth.current),
        delta: <PeriodDelta comparison={overview.customer_growth} period={period} />,
      };
    case "average_order":
      return {
        value: formatMoney(overview.average_order.current),
        delta: <PeriodDelta comparison={overview.average_order} period={period} />,
      };
    case "return_requests":
      return overview.return_requests
        ? {
            value: formatCount(overview.return_requests.current),
            delta: <PeriodDelta comparison={overview.return_requests} period={period} higherIsBetter={false} />,
          }
        : { value: "—", delta: UNAVAILABLE };
    case "stock_accuracy":
      return overview.stock_accuracy
        ? {
            value: `${overview.stock_accuracy.current.toFixed(0)}%`,
            delta: <AuditDelta accuracy={overview.stock_accuracy} />,
          }
        : { value: "—", delta: <span className="text-muted-foreground">No stock audits yet</span> };
    default:
      return { value: "—", delta: UNAVAILABLE };
  }
}
