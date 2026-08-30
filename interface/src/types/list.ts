// Shared across every generic doctype-driven list (Products, Sales Orders, ...).
import type { RowData } from "@tanstack/react-table";

import type { PERIODS } from "@/constants/list";

/** Alignment is a property of the column, not of the cell renderer: the same
 * GenericCell rendered inside a detail-page card must not suddenly right-align.
 * Declaring it on the column definition also keeps the header and the body
 * cells reading one value, so they cannot end up aligned differently. */
declare module "@tanstack/react-table" {
  // Type parameters must match table-core's own declaration exactly
  // (ColumnMeta<TData extends RowData, TValue>) or TS rejects the merge.
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "right";
    /** Every real header renders as JSX (for alignment), not a plain
     * string - `columnFieldsFrom` (data-table.tsx) reads this for the
     * column picker/filter popover instead of parsing rendered output. */
    label?: string;
  }
}

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
  | ">"
  | "<"
  | ">="
  | "<="
  | "in"
  | "not in"
  | "between";

export type FilterRow = {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
};

export type ColumnPrefs = {
  columnOrder: string[];
};

export type Period = (typeof PERIODS)[number];

export type PeriodComparison = { current: number; previous: number };
