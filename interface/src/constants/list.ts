// Shared across every generic doctype-driven list (Products, Sales Orders, ...).
import type { FilterOperator } from "@/types/list";

export const PERIODS = ["1D", "1W", "1M", "1Y"] as const;

export const PERIOD_LABEL: Record<(typeof PERIODS)[number], string> = {
  "1D": "day",
  "1W": "week",
  "1M": "month",
  "1Y": "year",
};

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  "=": "Equals",
  "!=": "Not equals",
  ">": "Greater than",
  "<": "Less than",
  ">=": "On or after",
  "<=": "On or before",
  in: "In",
  "not in": "Not in",
  between: "Between",
};

/** The status-pill vocabulary, defined once. Every doctype's status map picks
 * from these rather than writing colour classes, so a tone can be retuned in
 * one place instead of across five maps.
 *
 * A tone is a tinted fill plus a text colour: `bg-<tone>/10` in light mode,
 * `/15` in dark (the darker ground needs a stronger tint to read), with
 * `--<tone>-foreground` flipping to a lighter step in dark mode. */
export const STATUS_TONE = {
  /** Not started, or parked. Also the fallback for an unrecognised status. */
  neutral: "bg-muted text-muted-foreground border-none",
  /** In flight, nothing wrong. */
  info: "bg-info/10 text-info-foreground dark:bg-info/15 border-none",
  /** Settled well. */
  success:
    "bg-success/10 text-success-foreground dark:bg-success/15 border-none",
  /** Needs attention, not yet failed. */
  warning:
    "bg-warning/10 text-warning-foreground dark:bg-warning/15 border-none",
  /** A reversal or exception. */
  caution:
    "bg-caution/10 text-caution-foreground dark:bg-caution/15 border-none",
  /** Failed or void. */
  destructive: "bg-destructive/10 text-destructive border-none",
  /** Not a lifecycle state but a classification - only Item "Variant" uses it.
   * Left as a raw palette pair: a token for a single call site would be a
   * token nobody can reuse. Promote it if a second use ever appears. */
  structural:
    "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 border-none",
} as const;
/** Frappe fieldtypes that hold a number a user might compare down a column.
 * Drives both the filter operators offered for a field and the right-alignment
 * of its table column, so the two can't drift apart. */
export const NUMERIC_FIELDTYPES = [
  "Int",
  "Float",
  "Currency",
  "Percent",
] as const;

export function isNumericFieldtype(fieldtype: string | undefined): boolean {
  return NUMERIC_FIELDTYPES.includes(
    fieldtype as (typeof NUMERIC_FIELDTYPES)[number],
  );
}

export const NUMERIC_OPERATORS: FilterOperator[] = [
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "between",
];
export const DATE_OPERATORS: FilterOperator[] = [
  "=",
  ">",
  "<",
  ">=",
  "<=",
  "between",
];
export const SELECT_OPERATORS: FilterOperator[] = ["=", "!=", "in", "not in"];
export const TEXT_OPERATORS: FilterOperator[] = ["=", "!=", "in", "not in"];

/** The operator vocabulary a server-driven ("manual") filter can actually
 * use - every `FilterOperator` except `between`, since a Frappe list filter
 * has no single matching operator for it (there's no translation that
 * doesn't also mean changing what "between" means). Shared between
 * `FilterPopover` (which operator choices to even offer once a table is
 * server-filtered) and `runtime/data/resolver.ts` (which operator a
 * URL-supplied `${name}_filter_<field>_op` value is checked against) - kept
 * in one place so the two can't quietly drift apart. */
export const MANUAL_FILTER_OPERATORS: Exclude<FilterOperator, "between">[] = [
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "in",
  "not in",
];

/** The rows-per-page choices every table's pagination footer offers - also
 * the whitelist `resolver.ts`'s `readNamedPageSize` validates a URL-supplied
 * page size against, so a server-paginated table never lets an arbitrary
 * value reach Frappe. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/** The default per-page size - picking it back in the per-page `<Select>`
 * deletes the `${name}_page_size` URL param rather than writing it
 * explicitly (mirrors `usePaginationParam`'s own "default value means
 * delete the param" convention for page *number*), so a table left at its
 * default has a clean URL. */
export const DEFAULT_PAGE_SIZE: (typeof PAGE_SIZE_OPTIONS)[number] =
  PAGE_SIZE_OPTIONS[0];
