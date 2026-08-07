// Shared across every generic doctype-driven list (Products, Sales Orders, ...).
import type { PERIODS } from "@/constants/list";

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
