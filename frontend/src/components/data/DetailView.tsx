import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface DetailField {
  label: string;
  value: ReactNode;
  /** Span both grid columns - use for long text (descriptions, addresses). */
  wide?: boolean;
  /** Render `value` directly with no label/dt wrapper - for embedding a full table/list inside a section. */
  bare?: boolean;
}

export interface DetailSection {
  heading?: string;
  fields: DetailField[];
}

export interface DetailViewProps {
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel?: string;
  isLoading?: boolean;
  error?: { message?: string } | null;
  sections: DetailSection[];
  /** Small visual (image/avatar) placed to the left of the title. */
  leading?: ReactNode;
  actions?: ReactNode;
  /** Rendered between the header and the section grid (e.g. a stat-card row). */
  children?: ReactNode;
}

/**
 * Generic read-only detail layout: back link, header, optional stat-card
 * row, then a stack of labelled sections. New doctype detail screens supply
 * `sections` built from the real fetched document - see
 * docs/adding-a-screen.md.
 */
export function DetailView({
  title,
  subtitle,
  backHref,
  backLabel = "Back",
  isLoading,
  error,
  sections,
  leading,
  actions,
  children,
}: DetailViewProps) {
  return (
    <div className="max-w-[1520px] px-8 pt-[22px] pb-14">
      <Link to={backHref} className="flex w-fit items-center gap-1.5 text-[12.5px] text-ash transition-colors hover:text-navy">
        <ArrowLeft className="size-[14px]" />
        {backLabel}
      </Link>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error.message || "Couldn't load this record."}</AlertDescription>
        </Alert>
      )}

      <div className="mt-3.5 flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          {leading}
          <div className="min-w-0">
            {isLoading ? (
              <Skeleton className="h-8 w-56" />
            ) : (
              <h1 className="text-[25px] font-semibold tracking-[-.028em] text-ink">{title}</h1>
            )}
            {subtitle && <p className="mt-[7px] text-[12.5px] text-ash">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>

      {children && <div className="mt-6">{children}</div>}

      {isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="border-line-subtle">
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {sections.map((section, i) => (
            <Card
              key={section.heading ?? i}
              className={section.fields.some((f) => f.wide) ? "border-line-subtle md:col-span-2" : "border-line-subtle"}
            >
              {section.heading && (
                <CardHeader className="pb-0">
                  <CardTitle className="text-[11px] font-medium tracking-[.08em] text-ash uppercase">{section.heading}</CardTitle>
                </CardHeader>
              )}
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
                {section.fields.map((field) =>
                  field.bare ? (
                    <div key={field.label} className="col-span-2">
                      {field.value}
                    </div>
                  ) : (
                    <div key={field.label} className={field.wide ? "col-span-2" : undefined}>
                      <dt className="text-[12.5px] text-ash">{field.label}</dt>
                      <dd className="mt-0.5 text-[12.5px] font-medium tabular-nums text-ink">{field.value ?? "—"}</dd>
                    </div>
                  ),
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
