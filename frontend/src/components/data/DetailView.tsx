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
  actions?: ReactNode;
}

/**
 * Generic read-only detail layout: back link, header, and a stack of
 * labelled sections. New doctype detail screens supply `sections` built
 * from the real fetched document - see docs/adding-a-screen.md.
 */
export function DetailView({ title, subtitle, backHref, backLabel = "Back", isLoading, error, sections, actions }: DetailViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <Link to={backHref} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error.message || "Couldn't load this record."}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          {isLoading ? (
            <Skeleton className="h-8 w-56" />
          ) : (
            <h1 className="font-serif text-2xl font-bold text-foreground">{title}</h1>
          )}
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i}>
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
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section, i) => (
            <Card key={section.heading ?? i} className={section.fields.some((f) => f.wide) ? "md:col-span-2" : undefined}>
              {section.heading && (
                <CardHeader>
                  <CardTitle className="font-sans text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    {section.heading}
                  </CardTitle>
                </CardHeader>
              )}
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
                {section.fields.map((field) => (
                  <div key={field.label} className={field.wide ? "col-span-2" : undefined}>
                    <dt className="text-xs text-muted-foreground">{field.label}</dt>
                    <dd className="mt-0.5 text-sm text-foreground">{field.value ?? "—"}</dd>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
