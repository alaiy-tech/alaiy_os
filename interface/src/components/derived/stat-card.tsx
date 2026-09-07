import type React from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
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
  title,
  subtitle,
  icon,
  value,
  delta,
  summary,
  className,
}: {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  value: string;
  delta: React.ReactNode;
  summary?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("py-3 gap-3.5", className)}>
      <CardHeader className="gap-y-0">
        <CardTitle className="font-medium text-foreground text-md">
          {title}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {subtitle}
        </CardDescription>
        <CardAction>{icon}</CardAction>
      </CardHeader>
      <CardContent>
        <span className="text-[30px] text-accent-foreground tabular-nums leading-none tracking-tight">
          {value}
        </span>
      </CardContent>
      {summary && (
        <CardFooter className="bg-card border-0 gap-1.5 uppercase font-medium text-xs text-muted-foreground pt-0.5">
          <span className="font-semibold">{delta}</span>
          VS. {summary}
        </CardFooter>
      )}
    </Card>
  );
}
