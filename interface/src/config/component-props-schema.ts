import { z } from "zod";

import { KPI_BORDER_TONES } from "@/config/kpi-classes";
import { KPI_ICON_NAMES } from "@/config/kpi-icons";
import { ERPNEXT_BADGE_CATEGORIES } from "@/utils/get-badge-style";

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

const DYNAMIC_BADGE_PROPS_SCHEMA = z
  .object({
    content: z.string(),
    category: z.enum(ERPNEXT_BADGE_CATEGORIES),
    variant: z.enum([
      "default",
      "secondary",
      "destructive",
      "outline",
      "ghost",
      "link",
    ]),
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
    badgeCategory: z.enum(ERPNEXT_BADGE_CATEGORIES),
    // Can never be removed via the column picker, regardless of how many
    // columns are visible - see column-spec.tsx's `buildCompulsoryColumns`.
    compulsory: z.boolean(),
    // Cell values only, never the header - see column-spec.tsx's
    // `textStyleClass`. `.min(1)`: an empty array has nothing to opt into,
    // so it's rejected rather than silently accepted as a no-op.
    textStyle: z
      .array(z.enum(["bold", "italic", "underline", "medium", "semibold"]))
      .min(1),
    width: z.number(),
  })
  .partial({
    format: true,
    align: true,
    sortable: true,
    badgeCategory: true,
    compulsory: true,
    textStyle: true,
    width: true,
  })
  .strict();

const ROW_ACTION_SCHEMA = z.discriminatedUnion("type", [
  z.object({ type: z.literal("navigate"), url: z.string().min(1) }).strict(),
  z.object({ type: z.literal("edit") }).strict(),
  z.object({ type: z.literal("delete") }).strict(),
]);

const ROW_ACTION_ITEM_SCHEMA = z
  .object({
    label: z.string().min(1),
    tone: z.enum(["default", "destructive"]),
    action: ROW_ACTION_SCHEMA,
  })
  .partial({ tone: true })
  .strict();

const ROW_ACTION_GROUP_SCHEMA = z
  .object({
    items: z.array(ROW_ACTION_ITEM_SCHEMA).min(1),
  })
  .strict();

// The bulk "Actions (N)" button's own, narrower vocabulary - no "navigate"
// (jumping to one URL doesn't mean anything for an arbitrary selected set).
const BULK_ACTION_SCHEMA = z.discriminatedUnion("type", [
  z.object({ type: z.literal("edit") }).strict(),
  z.object({ type: z.literal("delete") }).strict(),
]);

const BULK_ACTION_ITEM_SCHEMA = z
  .object({
    label: z.string().min(1),
    tone: z.enum(["default", "destructive"]),
    action: BULK_ACTION_SCHEMA,
  })
  .partial({ tone: true })
  .strict();

const BULK_ACTION_GROUP_SCHEMA = z
  .object({
    // Unlike a row-actions group, a bulk-actions group may carry its own
    // label (`selection-actions.tsx`'s `DropdownMenuLabel`).
    label: z.string(),
    items: z.array(BULK_ACTION_ITEM_SCHEMA).min(1),
  })
  .partial({ label: true })
  .strict();

const TABLE_PAGINATION_SCHEMA = z
  .object({
    page: z.number(),
    pageSize: z.number(),
    hasMore: z.boolean(),
    total: z.number(),
  })
  .partial()
  .strict();

const OS_DATA_TABLE_PROPS_SCHEMA = z
  .object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    columns: z.array(COLUMN_SPEC_SCHEMA).optional(),
    rowId: z.string().optional(),
    currency: z.string().optional(),
    searchable: z.boolean().default(true),
    searchPlaceholder: z.string().optional(),
    searchFields: z.array(z.string()).optional(),
    searchParam: z.string().optional(),
    filterable: z.boolean().default(true),
    // Which resolved `fields` (the doctype's own field metadata - see
    // `DataDefinition.exposeFields`) never show up in the filter/column
    // popovers - e.g. a field already folded into another column's cell.
    // `fields` itself is never a literal `props` value: it's a `data`
    // binding (`{ ref: "<name>", path: "fields" }`), resolved the same way
    // `rows`/`pagination` already are - see `runtime/data/resolver.ts`.
    excludedFields: z.array(z.string()).optional(),
    columnVisibility: z.boolean().default(true),
    defaultColumnOrder: z.array(z.string()).optional(),
    structuralColumnIds: z.array(z.string()).optional(),
    minVisibleColumns: z.number().optional(),
    selectable: z.boolean().default(true),
    // A declarative "3 dots" actions column - see `row-actions.tsx`'s doc
    // comment for the closed navigate/edit/delete vocabulary. Omitted means
    // no actions column at all.
    actions: z.array(ROW_ACTION_GROUP_SCHEMA).optional(),
    // The bulk "Actions (N)" button, shown once a row is checkbox-selected -
    // see `selection-actions.tsx`'s doc comment. Required whenever
    // `selectable` is true (checked below) - a selectable table with nothing
    // to do with a selection is half-finished, not a valid minimal config.
    selectionActions: z.array(BULK_ACTION_GROUP_SCHEMA).optional(),
    paginated: z.boolean().default(true),
    // Client-mode-only: the table's own local page-slicing size, used only
    // when `pagination`/`pageParam` are both absent. Defaults to 10
    // (`OsDataTable`'s own default) when omitted entirely - a plain
    // `paginated: true` with nothing else is already a complete, working
    // config, so this is never required. Distinct from `pagination.pageSize`
    // (the server-resolved size a manual/server-paginated table actually
    // used) - the two are never both relevant at once.
    pageSize: z.number().optional(),
    pagination: TABLE_PAGINATION_SCHEMA.optional(),
    pageParam: z.string().optional(),
    pageSizeParam: z.string().optional(),
    sort: z.string().optional(),
    sortParam: z.string().optional(),
    emptyMessage: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.searchable && !value.searchPlaceholder) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "searchPlaceholder is required when searchable is true.",
        path: ["searchPlaceholder"],
      });
    }

    if (value.columnVisibility && value.minVisibleColumns === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minVisibleColumns is required when columnVisibility is true.",
        path: ["minVisibleColumns"],
      });
    }

    if (value.selectable && !value.selectionActions?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "selectionActions is required when selectable is true.",
        path: ["selectionActions"],
      });
    }
  });

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

const OS_PAGE_DYNAMIC_BADGE_PROPS_SCHEMA = DYNAMIC_BADGE_PROPS_SCHEMA;

const OS_PERIOD_TOGGLE_PROPS_SCHEMA = z
  .object({
    paramName: z.string(),
    // The full, author-ordered button list - the *first* entry is the
    // default (no separate `defaultPeriod`/`defaultValue` prop to keep in
    // sync with it by hand). Not constrained to `PERIODS`: this is a
    // generic button-group-driven-by-config toggle, not period-specific -
    // whether a given set of codes means anything to the data it scopes is
    // the author's responsibility (e.g. `/os`'s dashboard only understands
    // 1D/1W/1M/1Y today - see `runtime/data/resolver.ts`'s `PERIOD_TO_DAYS`).
    options: z.array(z.string()).min(1),
  })
  .partial({ paramName: true })
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
