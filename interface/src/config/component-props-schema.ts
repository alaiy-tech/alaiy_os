import { z } from "zod";

import { KPI_BORDER_TONES } from "@/config/kpi-classes";
import { KPI_ICON_NAMES } from "@/config/kpi-icons";
import { PERIODS } from "@/constants/list";

/**
 * Per-type `propsSchema` values for `runtime/registry/component-registry.ts`'s
 * `baseComponentRegistry` entries - checked by
 * `runtime/validate/validate-against-registry.ts`'s second pass against whatever a
 * node's literal `props` actually contains. Every field is `.optional()`,
 * even a `requiredFields`-listed one: a field supplied via a `data` binding
 * instead is legitimately absent from `props`, and presence is
 * `requiredFields`'s job, not this file's (see `types/runtime/registry.ts`'s
 * `propsSchema` doc comment). `.strict()` on every top-level object so an
 * unrecognised prop key - a typo, a field the component doesn't read - is a
 * validation error instead of a silent no-op.
 *
 * Mirrors the structural schemas in `page-schema.ts`, but deliberately kept
 * separate: that file validates "is this a well-formed page" independent of
 * any registry, this one validates "does this component's vocabulary match
 * what it actually renders."
 */

const OS_PAGE_HEADER_PROPS_SCHEMA = z
  .object({
    title: z.string(),
    subtitle: z.string(),
  })
  .partial()
  .strict();

const OS_CARD_PROPS_SCHEMA = z
  .object({
    title: z.string(),
    className: z.string(),
  })
  .partial()
  .strict();

const OS_KPI_PROPS_SCHEMA = z
  .object({
    title: z.string(),
    icon: z.enum(KPI_ICON_NAMES),
    value: z.union([z.number(), z.string()]),
    format: z.enum(["number", "currency", "percent"]),
    currency: z.string(),
    precision: z.number(),
    trend: z.number().nullable(),
    trendUnit: z.enum(["percent", "points"]),
    trendPolarity: z.enum(["positive", "negative"]),
    trendLabel: z.string(),
    borderTone: z.enum(KPI_BORDER_TONES),
  })
  .partial()
  .strict();

const COLUMN_SPEC_SCHEMA = z
  .object({
    field: z.string(),
    label: z.string(),
    format: z.enum(["text", "number", "currency", "date", "badge"]),
    align: z.enum(["left", "right", "center"]),
    sortable: z.boolean(),
    filterable: z.boolean(),
    filterOptions: z.array(z.string()),
    badgeTones: z.record(z.string(), z.string()),
    width: z.number(),
  })
  .partial({
    format: true,
    align: true,
    sortable: true,
    filterable: true,
    filterOptions: true,
    badgeTones: true,
    width: true,
  })
  .strict();

const OS_DATA_TABLE_PROPS_SCHEMA = z
  .object({
    title: z.string(),
    subtitle: z.string(),
    columns: z.array(COLUMN_SPEC_SCHEMA),
    rowId: z.string(),
    currency: z.string(),
    searchable: z.boolean(),
    searchPlaceholder: z.string(),
    columnVisibility: z.boolean(),
    compulsoryColumns: z.array(z.string()),
    minVisibleColumns: z.number(),
    selectable: z.boolean(),
    paginated: z.boolean(),
    pageSize: z.number(),
    emptyMessage: z.string(),
    // The URL search param this table's page number reads/writes when its
    // `rows`/`pagination` are bound to a paginated source (e.g.
    // "customers_page") - see docs/UI_RUNTIME.md's "Paginated Data Sources".
    // No name here means Next/Previous render disabled, deliberately.
    pageParam: z.string(),
    // Same convention as `pageParam`, for sort instead of page number (e.g.
    // "suppliers_sort") - see docs/UI_RUNTIME.md's "Generic List Query
    // State". No name here means a sortable header click does nothing.
    sortParam: z.string(),
  })
  .partial()
  .strict();

const CHART_SERIES_SCHEMA = z
  .object({
    field: z.string(),
    label: z.string(),
    type: z.enum(["bar", "line", "area"]),
    color: z.string(),
  })
  .partial({ color: true })
  .strict();

const OS_CHART_PROPS_SCHEMA = z
  .object({
    title: z.string(),
    subtitle: z.string(),
    x: z.string(),
    series: z.array(CHART_SERIES_SCHEMA),
    legend: z.boolean(),
    height: z.number(),
  })
  .partial()
  .strict();

const FILTER_FIELD_CONFIG_SCHEMA = z
  .object({
    id: z.string(),
    type: z.enum(["select", "text", "date-range"]),
    label: z.string(),
    searchParam: z.string(),
    options: z.array(z.string()),
    defaultValue: z.string(),
    placeholder: z.string(),
  })
  .partial({ options: true, defaultValue: true, placeholder: true })
  .strict();

const OS_FILTER_BAR_PROPS_SCHEMA = z
  .object({
    filters: z.array(FILTER_FIELD_CONFIG_SCHEMA),
    // URL params to clear alongside a filter's own when its value changes
    // (or on Reset) - e.g. a paginated table's `pageParam`, so a filter
    // change doesn't leave the user stranded on a page number that no
    // longer matches the new result set. Fully generic: this component
    // never knows what the listed params mean, only that they should go
    // away. See docs/UI_RUNTIME.md's "Paginated Data Sources".
    resetPageParams: z.array(z.string()),
  })
  .partial()
  .strict();

const OS_PAGE_DYNAMIC_BADGE_PROPS_SCHEMA = z
  .object({
    category: z.enum([
      "docstatus",
      "job",
      "payment",
      "sales",
      "stock",
      "project",
      "hr",
      "manufacturing",
      "generic",
    ]),
    content: z.string(),
  })
  .partial()
  .strict();

const OS_PERIOD_TOGGLE_PROPS_SCHEMA = z
  .object({
    paramName: z.string(),
    defaultPeriod: z.enum(PERIODS),
  })
  .partial()
  .strict();

export const COMPONENT_PROPS_SCHEMAS = {
  "os-page-header": OS_PAGE_HEADER_PROPS_SCHEMA,
  "os-dynamic-badge": OS_PAGE_DYNAMIC_BADGE_PROPS_SCHEMA,
  "os-card": OS_CARD_PROPS_SCHEMA,
  "os-kpi": OS_KPI_PROPS_SCHEMA,
  "os-data-table": OS_DATA_TABLE_PROPS_SCHEMA,
  "os-chart": OS_CHART_PROPS_SCHEMA,
  "os-filter-bar": OS_FILTER_BAR_PROPS_SCHEMA,
  "os-period-toggle": OS_PERIOD_TOGGLE_PROPS_SCHEMA,
} as const;
