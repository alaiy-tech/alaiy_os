import type React from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/primitive/card";
import { KPI_BORDER_TONE_CLASSES } from "@/config/kpi-classes";
import { cn } from "@/lib/utils";
import type { OsKpiBorderTone } from "@/types/kpi";

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
  borderTone,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  delta: React.ReactNode;
  summary: React.ReactNode;
  borderTone?: OsKpiBorderTone;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "relative h-full overflow-hidden rounded-none border border-border ring-0 rounded-xl",
        className,
      )}
    >
      {borderTone && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 w-1",
            KPI_BORDER_TONE_CLASSES[borderTone],
          )}
        />
      )}
      <CardHeader>
        <CardDescription className="text-sm">{label}</CardDescription>
        <CardAction className="grid mt-0.5 scale-125 place-items-center rounded-sm">
          {icon}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="text-2xl text-foreground tabular-nums leading-none tracking-tight">
            {value}
          </span>
          {delta}
        </div>
        <p className="text-sm">{summary}</p>
      </CardContent>
    </Card>
  );
}
