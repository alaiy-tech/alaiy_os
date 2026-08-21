import type {
  DocFieldMeta,
  FilterOperator,
  FilterRow,
} from "@/components/derived/list/types";

/** In-memory sibling of `@/components/list/types`' `toFrappeFilters` - same
 * `FilterOperator` vocabulary, evaluated against JS values directly instead
 * of built into a REST query string. Exists because `OsDataTable` (unlike
 * Products/Sales Orders/Purchase Orders) filters an already-fetched
 * in-memory array rather than re-querying Frappe per filter change. */

const NUMERIC_FIELDTYPES = new Set(["Int", "Float", "Currency", "Percent"]);

function coerceForCompare(
  value: unknown,
  fieldtype: string | undefined,
): number | string | null {
  if (value === null || value === undefined || value === "") return null;

  if (fieldtype && NUMERIC_FIELDTYPES.has(fieldtype)) {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  }

  if (fieldtype === "Date" || fieldtype === "Datetime") {
    const time = new Date(String(value)).getTime();
    return Number.isNaN(time) ? null : time;
  }

  return String(value).toLowerCase();
}

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function matchesRow(
  row: Record<string, unknown>,
  filterRow: FilterRow,
  fieldsByName: Map<string, DocFieldMeta>,
): boolean {
  const fieldtype = fieldsByName.get(filterRow.field)?.fieldtype;
  const raw = row[filterRow.field];
  const operator: FilterOperator = filterRow.operator;

  if (operator === "is") return raw !== null && raw !== undefined && raw !== "";
  if (operator === "is not")
    return raw === null || raw === undefined || raw === "";

  if (operator === "like" || operator === "not like") {
    const matches = String(raw ?? "")
      .toLowerCase()
      .includes(filterRow.value.toLowerCase());
    return operator === "like" ? matches : !matches;
  }

  if (operator === "in" || operator === "not in") {
    const values = filterRow.value
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const matches = values.includes(String(raw ?? "").toLowerCase());
    return operator === "in" ? matches : !matches;
  }

  if (operator === "between") {
    const [startRaw, endRaw] = filterRow.value
      .split(",")
      .map((value) => value.trim());
    const current = coerceForCompare(raw, fieldtype);
    const start = coerceForCompare(startRaw, fieldtype);
    const end = coerceForCompare(endRaw, fieldtype);
    if (current === null || start === null || end === null) return false;
    return (
      compareValues(current, start) >= 0 && compareValues(current, end) <= 0
    );
  }

  const current = coerceForCompare(raw, fieldtype);
  const target = coerceForCompare(filterRow.value, fieldtype);
  if (current === null || target === null) return operator === "!=";

  const comparison = compareValues(current, target);
  switch (operator) {
    case "=":
      return comparison === 0;
    case "!=":
      return comparison !== 0;
    case ">":
      return comparison > 0;
    case "<":
      return comparison < 0;
    case ">=":
      return comparison >= 0;
    case "<=":
      return comparison <= 0;
    default:
      return true;
  }
}

/** Filters an in-memory array by a `FilterRow[]` (from `FilterPopover`),
 * ANDing every row with a non-empty `field`. `fields` supplies each row's
 * `fieldtype` so numeric/date operators compare coerced values rather than
 * strings. */
export function applyFilterRows<TData>(
  data: TData[],
  rows: FilterRow[],
  fields: DocFieldMeta[],
): TData[] {
  const active = rows.filter((row) => row.field);
  if (active.length === 0) return data;

  const fieldsByName = new Map(fields.map((field) => [field.fieldname, field]));
  return data.filter((row) =>
    active.every((filterRow) =>
      matchesRow(row as Record<string, unknown>, filterRow, fieldsByName),
    ),
  );
}
