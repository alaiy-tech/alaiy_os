import type { ReactNode } from "react";

/** Title + subtitle + right-aligned action slot, shared by every page.tsx
 * that opens with this shape. Pure presentational - safe to render directly
 * from a Server Component, no "use client" needed here.
 *
 * Renders the page's h1: it is the first heading on the page, so anything
 * lower leaves a screen-reader user navigating by heading with no page title.
 * Every page uses this once and only once - section headings inside a page
 * are CardTitle or a plain h2, not another PageHeader. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
