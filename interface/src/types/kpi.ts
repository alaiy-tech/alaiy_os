import type { KPI_BORDER_TONES } from "@/config/kpi-classes";
import type { KPI_ICONS } from "@/config/kpi-icons";

/** The `icon` prop's vocabulary - the exact PascalCase keys of
 * `config/kpi-icons.ts`'s curated lookup, so an unrecognised name is a
 * compile-time error for anyone hand-authoring a seed row, not a silently
 * missing icon at runtime. */
export type OsKpiIconName = keyof typeof KPI_ICONS;

/** `value`'s display type is always text by the time it reaches
 * `StatCard` - `formatValue` (components/registry/kpi.tsx) auto-typecasts a
 * raw number from a Data Source into a formatted string per this option; a
 * string value already provided by the source passes through unchanged. */
export type OsKpiFormat = "number" | "currency" | "percent";

export type OsKpiTrendUnit = "percent" | "points";
export type OsKpiTrendPolarity = "positive" | "negative";

/** Optional accent bar down the card's leading edge. A semantic tone name,
 * not a colour - resolved to a token class by
 * `config/kpi-classes.ts`'s `KPI_BORDER_TONE_CLASSES`. `undefined` (the
 * default for every KPI node seeded today) renders no accent bar at all. */
export type OsKpiBorderTone = (typeof KPI_BORDER_TONES)[number];
