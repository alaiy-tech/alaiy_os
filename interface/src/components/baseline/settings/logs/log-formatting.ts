import type { DocFieldMeta } from "@/components/derived/list/types";
import { formatDate, formatDateTime, formatQty } from "@/lib/format";
import type { LogRow } from "@/types/logs";

/** How many of the doctype's own columns the table shows beside the timestamp.
 * A log doctype can mark any number of fields `in_list_view`; past about five
 * the row stops being scannable, and the drawer holds the rest. */
const MAX_COLUMNS = 5;

/** Fieldtypes that hold more text than a table cell can show. They are still
 * offered in the drawer — this only keeps them out of the table. */
const LONG_TEXT_FIELDTYPES = new Set(["Text", "Small Text", "Long Text", "Text Editor", "Code", "JSON", "Markdown"]);

/** The doctype's own list columns, in the order its meta declares them.
 *
 * Driven by `in_list_view` rather than a list this page keeps, so a connector
 * decides how its log reads by marking fields in its own doctype. A log that
 * marks nothing falls back to whatever short fields it has, which is better
 * than a table of one timestamp column. */
export function logColumns(fields: DocFieldMeta[]): DocFieldMeta[] {
  const shortFields = fields.filter((field) => !LONG_TEXT_FIELDTYPES.has(field.fieldtype));

  const declared = shortFields.filter((field) => field.in_list_view);
  const chosen = declared.length > 0 ? declared : shortFields;

  return chosen.slice(0, MAX_COLUMNS);
}

/** A field's value as text, decided by its fieldtype alone.
 *
 * The page knows nothing about any particular log's fields, so there is no
 * per-field special-casing here — a status code and a duration are both Ints
 * and are rendered the same way. */
export function formatFieldValue(value: unknown, fieldtype: string): string {
  if (value === null || value === undefined || value === "") return "—";

  switch (fieldtype) {
    case "Datetime":
      return formatDateTime(String(value));
    case "Date":
      return formatDate(String(value));
    case "Check":
      return value ? "Yes" : "No";
    case "Int":
    case "Float":
    case "Percent":
      return formatQty(Number(value));
    default:
      return String(value);
  }
}

/** The fields worth showing in the drawer, in meta order.
 *
 * Frappe returns every column on the document, including the housekeeping ones
 * (`owner`, `modified_by`, `docstatus`, `idx`, …) that say nothing about what
 * the log recorded. Filtering to the doctype's declared fields drops those
 * without this page having to name them one by one. */
export function drawerFields(fields: DocFieldMeta[], doc: LogRow): DocFieldMeta[] {
  return fields.filter((field) => {
    const value = doc[field.fieldname];
    return value !== null && value !== undefined && value !== "";
  });
}

export function isLongText(fieldtype: string): boolean {
  return LONG_TEXT_FIELDTYPES.has(fieldtype);
}
