// Types and constants now live under src/types and src/constants (single
// source of truth) - this module keeps the filter-building logic that
// operates on them, re-exporting what existing imports of
// "@/components/list/types" still expect.
import {
  DATE_OPERATORS,
  isNumericFieldtype,
  NUMERIC_OPERATORS,
  SELECT_OPERATORS,
  TEXT_OPERATORS,
} from "@/constants/list";
import type { FilterOperator, FilterRow } from "@/types/list";

export { OPERATOR_LABELS } from "@/constants/list";
export type { ColumnPrefs, DocFieldMeta, FilterOperator, FilterRow } from "@/types/list";

export function operatorsForFieldtype(fieldtype: string | undefined): FilterOperator[] {
  if (isNumericFieldtype(fieldtype)) return NUMERIC_OPERATORS;
  switch (fieldtype) {
    case "Date":
    case "Datetime":
      return DATE_OPERATORS;
    case "Select":
    case "Link":
      return SELECT_OPERATORS;
    default:
      return TEXT_OPERATORS;
  }
}

/** Frappe's REST list filters are [fieldname, operator, value] triples.
 * `in`/`not in`/`between` take an array, split from the row's
 * comma-separated text input. */
export function toFrappeFilters(rows: FilterRow[]): Array<[string, string, unknown]> {
  return rows
    .filter((r) => r.field)
    .map((r) => {
      if (r.operator === "in" || r.operator === "not in") {
        return [
          r.field,
          r.operator,
          r.value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
        ] as [string, string, unknown];
      }
      if (r.operator === "between") {
        return [r.field, r.operator, r.value.split(",").map((v) => v.trim())] as [string, string, unknown];
      }
      return [r.field, r.operator, r.value] as [string, string, unknown];
    });
}
