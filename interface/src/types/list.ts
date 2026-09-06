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
