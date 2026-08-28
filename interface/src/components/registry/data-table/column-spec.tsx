import type { ReactNode } from "react";

import type { ColumnDef } from "@tanstack/react-table";
import { format as formatDate, parseISO } from "date-fns";
import { ArrowUpDown } from "lucide-react";

import type { DocFieldMeta } from "@/components/derived/list/types";
import { Button } from "@/components/primitive/button";
import { DynamicBadge } from "@/components/registry/dynamic-badge";
import { formatCurrency } from "@/utils/format";
import type { ERPNextBadgeCategory } from "@/utils/get-badge-style";

/**
 * The `data-table` capability contract's column shape (brief §20) - plain,
 * JSON-safe data (no render functions), so it can live directly in a page's
 * `props.columns` and cross the Server -> Client boundary like any other
 * prop. `buildColumnDefs` turns this into real TanStack `ColumnDef`s
 * *inside* the client component that consumes it - the function-building
 * step never crosses a boundary, only the plain spec does.
 */
export type ColumnFormat = "text" | "number" | "currency" | "date" | "badge";

export type ColumnSpec = {
  field: string;
  label: string;
  format?: ColumnFormat;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  filterable?: boolean;
  /** Only meaningful for `format: "badge"` - if the badge's possible values
   * are a known closed set, filtering treats it as a Select field (which
   * `FilterPopover` still solicits as free text for, matching every other
   * Select/Link field in this app - see filter-popover.tsx). */
  filterOptions?: string[];
  /** `format: "badge"` only - which `os-dynamic-badge` category resolves the
   * value's colour (`utils/get-badge-style.ts`). Omitted falls back to
   * `"generic"`, which still auto-matches a value found in any category's
   * map before giving up to a neutral tone. */
  badgeCategory?: ERPNextBadgeCategory;
  /** Marks this column's filter as server-driven: instead of the generic
   * in-memory `FilterPopover`, its value round-trips through this URL search
   * param (see `buildManualFilterFields`) and the server is assumed to have
   * already applied it - only meaningful alongside `filterable: true`. */
  filterParam?: string;
  width?: number;
};

export type ManualFilterField = {
  field: string;
  label: string;
  param: string;
  options?: string[];
};

function alignClass(align: ColumnSpec["align"]): string | undefined {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return undefined;
}

function formatCell(value: unknown, spec: ColumnSpec, currency: string | undefined): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;

  switch (spec.format) {
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "currency":
      return typeof value === "number" ? formatCurrency(value, { currency }) : String(value);
    case "date": {
      const date = typeof value === "string" ? parseISO(value) : new Date(value as string | number);
      return Number.isNaN(date.getTime()) ? String(value) : formatDate(date, "d MMM yyyy");
    }
    case "badge":
      return <DynamicBadge content={String(value)} category={spec.badgeCategory ?? "generic"} />;
    default:
      return String(value);
  }
}

function SortableHeader({ label, align, onClick }: { label: string; align: ColumnSpec["align"]; onClick: () => void }) {
  return (
    <div className={alignClass(align)}>
      <Button variant="ghost" className={align === "right" ? "-mr-3" : "-ml-3"} onClick={onClick}>
        {label}
        <ArrowUpDown className="size-3.5" />
      </Button>
    </div>
  );
}

/** Builds real TanStack column defs from a declarative `ColumnSpec[]` -
 * generic cell rendering keyed by `format`, nothing per-domain. `TRow` is
 * always a plain object (a resolved data-source row), never anything with
 * its own render functions. */
export function buildColumnDefs<TRow extends Record<string, unknown>>(
  columns: ColumnSpec[],
  currency: string | undefined,
): ColumnDef<TRow, unknown>[] {
  return columns.map((spec, index) => {
    // The last column's title right-aligns by default (an author-declared
    // `align` always wins) - a table with no explicit alignment reads better
    // when its trailing column (usually a number/date/action) lines up with
    // the table's right edge instead of trailing off to the left.
    const isLast = index === columns.length - 1;
    const effectiveAlign = spec.align ?? (isLast ? "right" : undefined);

    return {
      id: spec.field,
      accessorKey: spec.field,
      enableSorting: spec.sortable ?? false,
      header: spec.sortable
        ? ({ column }) => (
            <SortableHeader
              label={spec.label}
              align={effectiveAlign}
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            />
          )
        : () => <div className={alignClass(effectiveAlign)}>{spec.label}</div>,
      cell: ({ row }) => (
        <div className={alignClass(effectiveAlign)}>{formatCell(row.original[spec.field], spec, currency)}</div>
      ),
    };
  });
}

const FORMAT_TO_FIELDTYPE: Record<ColumnFormat, string> = {
  text: "Data",
  number: "Float",
  currency: "Currency",
  date: "Date",
  badge: "Data",
};

/** Derives `FilterPopover`'s required `DocFieldMeta[]` from whichever columns
 * declare `filterable: true` *without* a `filterParam` - a `filterParam`
 * column is server-driven (see `buildManualFilterFields`) and must not also
 * get a local in-memory filter row, since the data it would filter is
 * already just the current server-resolved page. The same declarative spec
 * drives both cell rendering and the filter builder's field/operator
 * vocabulary, so the two can never drift apart. */
export function buildFilterFields(columns: ColumnSpec[]): DocFieldMeta[] {
  return columns
    .filter((column) => column.filterable && !column.filterParam)
    .map((column) => ({
      fieldname: column.field,
      label: column.label,
      fieldtype:
        column.format === "badge" && column.filterOptions ? "Select" : FORMAT_TO_FIELDTYPE[column.format ?? "text"],
      options: column.filterOptions?.join("\n") ?? null,
      read_only: false,
      unique: false,
      permlevel: 0,
      in_list_view: true,
    }));
}

/** The server-driven counterpart to `buildFilterFields` - one entry per
 * `filterable` column that also declares a `filterParam`. Each field's
 * operator is fixed server-side (`query.filters` in the page's data
 * definition), so unlike `FilterPopover` there is no operator to collect
 * here, only a value. */
export function buildManualFilterFields(columns: ColumnSpec[]): ManualFilterField[] {
  return columns
    .filter((column): column is ColumnSpec & { filterParam: string } =>
      Boolean(column.filterable && column.filterParam),
    )
    .map((column) => ({
      field: column.field,
      label: column.label,
      param: column.filterParam,
      options: column.filterOptions,
    }));
}
