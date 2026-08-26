import type React from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/primitive/card";
import { cn } from "@/utils";

/**
 * Fully generic KPI card - label, icon, formatted value, a pre-rendered
 * delta badge shown next to the value, and a pre-rendered summary line
 * underneath. No metric-specific math lives here (period comparisons, money
 * vs. count formatting, delta colour/polarity): that's `OsKpi`'s concern
 * (`components/registry/kpi.tsx`), computed before this component ever sees
 * the data. Matches the pre-Round-4 KPI card shape documented as the
 * reference implementation in docs/DESIGN.md's "KPI row" section
 * (`SalesOrderKpiCards`), now generic across every page instead of
 * per-feature.
 */
export function StatCard({
  label,
  icon,
  value,
  delta,
  summary,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  delta: React.ReactNode;
  summary: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn("relative h-full overflow-hidden border ring-0", className)}
    >
      <CardHeader>
        <CardDescription className="text-sm mb-1.5 text-foreground">
          {label}
        </CardDescription>
        <CardAction className="grid mt-1 scale-125 place-items-center rounded-sm">
          {icon}
        </CardAction>
        <span className="text-3xl pt-1 pb-0.5 text-foreground tabular-nums leading-none tracking-tight">
          {value}
        </span>
        <div className="py-0 flex flex-row items-center gap-1 pt-1.5">
          {delta} {summary}
        </div>
      </CardHeader>
    </Card>
  );
}
