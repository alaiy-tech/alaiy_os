import { PERIOD_LABEL, type Period } from "@/components/list/period";
import type { StockAccuracy } from "@/types/dashboard";
import type { PeriodComparison } from "@/types/list";

/** `/os`'s own KPI delta rendering - colocated with the rest of `/os`'s
 * components now that the headless runtime's `os-kpi` computes its deltas
 * generically instead (see `ui-runtime/data/sources/dashboard.ts`). `/os`
 * itself is untouched: same math, same markup, just moved from
 * `features/dashboard/` (deleted in Round 4 - nothing "feature-specific"
 * exists in this runtime anymore) to sit directly beside its one remaining
 * caller, `kpi-strip.tsx`. */

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
