import type { ReactNode } from "react";

import { TrendingDown, TrendingUp } from "lucide-react";

import { PERIOD_LABEL, type Period } from "@/components/list/period";
import { Badge } from "@/components/primitive/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { CustomersOverview } from "@/types/customers";
import type { PeriodComparison } from "@/types/list";

/** Customers-specific KPI math and delta rendering - the same job as
 * `features/dashboard/kpi-source.tsx`, but genuinely different presentation
 * (a badge + a descriptive line, not dashboard's plain coloured text), which
 * is exactly why this lives per-feature rather than being forced into one
 * shared delta renderer. `/os/customers`'s own `customer-kpi-cards.tsx`
 * computes this inline today; nothing there is touched. */

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export type CustomerKpiMetric =
  | "total_customers"
  | "new_customers"
  | "active_customers"
  | "revenue_per_customer";

export type ResolvedCustomerKpi = { value: string; delta: ReactNode };

function formatCustomers(value: number): string {
  const rounded = Math.round(value);
  return `${rounded.toLocaleString()} ${rounded === 1 ? "Customer" : "Customers"}`;
}

function deltaNode(
  comparison: PeriodComparison,
  period: Period,
  format: (value: number) => string,
): ReactNode {
  const { current, previous } = comparison;
  const diff = current - previous;
  const pct = pctChange(current, previous);
  const isUp = diff >= 0;

  return (
    <div className="space-y-1">
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
      <p className="text-muted-foreground text-xs">
        <span className="font-medium text-foreground">
          {format(Math.abs(diff))}
        </span>{" "}
        {isUp ? "more" : "less"} than last {PERIOD_LABEL[period]}
      </p>
    </div>
  );
}

const UNAVAILABLE = (
  <span className="text-muted-foreground">Not available</span>
);

export function computeCustomerKpi(
  metric: CustomerKpiMetric,
  overview: CustomersOverview | null,
  period: Period,
  defaultCurrency?: string,
): ResolvedCustomerKpi {
  if (!overview) return { value: "—", delta: UNAVAILABLE };

  const formatMoney = (value: number) =>
    formatCurrency(value, { currency: defaultCurrency });

  switch (metric) {
    case "total_customers":
      return {
        value: formatCustomers(overview.total_customers.current),
        delta: deltaNode(overview.total_customers, period, formatCustomers),
      };
    case "new_customers":
      return {
        value: formatCustomers(overview.new_customers.current),
        delta: deltaNode(overview.new_customers, period, formatCustomers),
      };
    case "active_customers":
      return {
        value: formatCustomers(overview.active_customers.current),
        delta: deltaNode(overview.active_customers, period, formatCustomers),
      };
    case "revenue_per_customer":
      return {
        value: formatMoney(overview.revenue_per_customer.current),
        delta: deltaNode(overview.revenue_per_customer, period, formatMoney),
      };
    default:
      return { value: "—", delta: UNAVAILABLE };
  }
}
