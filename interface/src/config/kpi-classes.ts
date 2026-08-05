/** Semantic tone names for `os-kpi`'s optional accent bar - never a
 * hardcoded colour (see docs/DESIGN.md). `types/kpi.ts`'s `OsKpiBorderTone`
 * and `component-props-schema.ts`'s `borderTone` enum both derive from this
 * one list. */
export const KPI_BORDER_TONES = ["primary", "success", "warning", "caution", "destructive", "info"] as const;

/** A literal table, not a template string - Tailwind's build-time class
 * scanner needs a static string per class (see `layout-classes.ts`). */
export const KPI_BORDER_TONE_CLASSES: Record<(typeof KPI_BORDER_TONES)[number], string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  caution: "bg-caution",
  destructive: "bg-destructive",
  info: "bg-info",
};
