/** Canonical accent-tone vocabulary for the `os-kpi` registry component's
 * optional border - a semantic tone name, never a hardcoded colour (see
 * docs/DESIGN.md's colour-token rule), mapped below to the same
 * `--success`/`--warning`/`--caution`/`--destructive`/`--info`/`--primary`
 * tokens the status-pill system already uses. The single source both
 * `KPI_BORDER_TONE_CLASSES` and `types/kpi.ts`'s `OsKpiBorderTone` type (and
 * `component-props-schema.ts`'s `borderTone` enum) derive from, so adding a
 * tone is one line, not three kept in sync by hand - the same pattern
 * `constants/list.ts`'s `PERIODS` already establishes. */
export const KPI_BORDER_TONES = ["primary", "success", "warning", "caution", "destructive", "info"] as const;

/** A literal table, not a template string, for the same Tailwind v4
 * build-time-scanner reason `layout-classes.ts` documents. */
export const KPI_BORDER_TONE_CLASSES: Record<(typeof KPI_BORDER_TONES)[number], string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  caution: "bg-caution",
  destructive: "bg-destructive",
  info: "bg-info",
};
