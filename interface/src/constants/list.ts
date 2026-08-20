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
  like: "Like",
  "not like": "Not like",
  ">": "Greater than",
  "<": "Less than",
  ">=": "On or after",
  "<=": "On or before",
  in: "In",
  "not in": "Not in",
  between: "Between",
  is: "Is set",
  "is not": "Is not set",
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
  neutral: "bg-muted text-muted-foreground",
  /** In flight, nothing wrong. */
  info: "bg-info/10 text-info-foreground dark:bg-info/15",
  /** Settled well. */
  success: "bg-success/10 text-success-foreground dark:bg-success/15",
  /** Needs attention, not yet failed. */
  warning: "bg-warning/10 text-warning-foreground dark:bg-warning/15",
  /** A reversal or exception. */
  caution: "bg-caution/10 text-caution-foreground dark:bg-caution/15",
  /** Failed or void. */
  destructive: "bg-destructive/10 text-destructive",
  /** Not a lifecycle state but a classification - only Item "Variant" uses it.
   * Left as a raw palette pair: a token for a single call site would be a
   * token nobody can reuse. Promote it if a second use ever appears. */
  structural: "bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
} as const;
/** Frappe fieldtypes that hold a number a user might compare down a column.
 * Drives both the filter operators offered for a field and the right-alignment
 * of its table column, so the two can't drift apart. */
export const NUMERIC_FIELDTYPES = ["Int", "Float", "Currency", "Percent"] as const;

export function isNumericFieldtype(fieldtype: string | undefined): boolean {
  return NUMERIC_FIELDTYPES.includes(fieldtype as (typeof NUMERIC_FIELDTYPES)[number]);
}

export const NUMERIC_OPERATORS: FilterOperator[] = ["=", "!=", ">", "<", ">=", "<=", "between", "is", "is not"];
export const DATE_OPERATORS: FilterOperator[] = ["=", ">", "<", ">=", "<=", "between", "is", "is not"];
export const SELECT_OPERATORS: FilterOperator[] = ["=", "!=", "in", "not in", "is", "is not"];
export const TEXT_OPERATORS: FilterOperator[] = ["like", "not like", "=", "!=", "in", "not in", "is", "is not"];
