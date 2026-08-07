export type DocFieldMeta = {
  fieldname: string;
  label: string;
  fieldtype: string;
  options?: string | null;
  read_only: boolean;
  unique: boolean;
  permlevel: number;
  in_list_view: boolean;
};

export type FilterOperator =
  | "="
  | "!="
  | "like"
  | "not like"
  | ">"
  | "<"
  | ">="
  | "<="
  | "in"
  | "not in"
  | "between"
  | "is"
  | "is not";

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

const NUMERIC_OPERATORS: FilterOperator[] = ["=", "!=", ">", "<", ">=", "<=", "between", "is", "is not"];
const DATE_OPERATORS: FilterOperator[] = ["=", ">", "<", ">=", "<=", "between", "is", "is not"];
const SELECT_OPERATORS: FilterOperator[] = ["=", "!=", "in", "not in", "is", "is not"];
const TEXT_OPERATORS: FilterOperator[] = ["like", "not like", "=", "!=", "in", "not in", "is", "is not"];

export function operatorsForFieldtype(fieldtype: string | undefined): FilterOperator[] {
  switch (fieldtype) {
    case "Int":
    case "Float":
    case "Currency":
    case "Percent":
      return NUMERIC_OPERATORS;
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

export type FilterRow = {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
};

export type ColumnPrefs = {
  columnOrder: string[];
};

/** Frappe's REST list filters are [fieldname, operator, value] triples. `like`
 * needs the %wildcards% Frappe's own report view adds automatically for you
 * elsewhere but not here; `in`/`not in`/`between` take an array, split from
 * the row's comma-separated text input; `is`/`is not` take the literal
 * strings "set"/"not set", not the row's (unused) value field. */
export function toFrappeFilters(rows: FilterRow[]): Array<[string, string, unknown]> {
  return rows
    .filter((r) => r.field)
    .map((r) => {
      if (r.operator === "is" || r.operator === "is not") {
        return [r.field, r.operator, "set"] as [string, string, unknown];
      }
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
      if (r.operator === "like" || r.operator === "not like") {
        return [r.field, r.operator, `%${r.value}%`] as [string, string, unknown];
      }
      return [r.field, r.operator, r.value] as [string, string, unknown];
    });
}
