import type { ReactNode } from "react";

/** Title + subtitle + right-aligned action slot, shared by every page.tsx
 * that opens with this shape (a KPI section's heading + its PeriodToggle,
 * a list page's title, ...). Pure presentational - safe to render directly
 * from a Server Component, no "use client" needed here. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
