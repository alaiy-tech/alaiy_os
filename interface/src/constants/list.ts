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

export const NUMERIC_OPERATORS: FilterOperator[] = ["=", "!=", ">", "<", ">=", "<=", "between", "is", "is not"];
export const DATE_OPERATORS: FilterOperator[] = ["=", ">", "<", ">=", "<=", "between", "is", "is not"];
export const SELECT_OPERATORS: FilterOperator[] = ["=", "!=", "in", "not in", "is", "is not"];
export const TEXT_OPERATORS: FilterOperator[] = ["like", "not like", "=", "!=", "in", "not in", "is", "is not"];
