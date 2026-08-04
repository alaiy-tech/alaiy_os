import type { ReactNode } from "react";

import type { ColumnDef } from "@tanstack/react-table";
import { format as formatDate, parseISO } from "date-fns";
import { ArrowUpDown } from "lucide-react";

import type { DocFieldMeta } from "@/components/derived/list/types";
import { Button } from "@/components/primitive/button";
import { STATUS_TONE } from "@/constants/list";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils";

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
  /** `format: "badge"` only - raw value -> a `STATUS_TONE`-style class.
   * Unmapped values fall back to `STATUS_TONE.neutral`. */
  badgeTones?: Record<string, string>;
  width?: number;
};

function alignClass(align: ColumnSpec["align"]): string | undefined {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return undefined;
}

function formatCell(
  value: unknown,
  spec: ColumnSpec,
  currency: string | undefined,
): ReactNode {
  if (value === null || value === undefined || value === "")
    return <span className="text-muted-foreground">—</span>;

  switch (spec.format) {
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "currency":
      return typeof value === "number"
        ? formatCurrency(value, { currency })
        : String(value);
    case "date": {
      const date =
        typeof value === "string"
          ? parseISO(value)
          : new Date(value as string | number);
      return Number.isNaN(date.getTime())
        ? String(value)
        : formatDate(date, "d MMM yyyy");
    }
    case "badge": {
      const tone = spec.badgeTones?.[String(value)] ?? STATUS_TONE.neutral;
      return (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs",
            tone,
          )}
        >
          {String(value)}
        </span>
      );
    }
    default:
      return String(value);
  }
}

function SortableHeader({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={onClick}>
      {label}
      <ArrowUpDown className="size-3.5" />
    </Button>
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
  return columns.map((spec) => ({
    id: spec.field,
    accessorKey: spec.field,
    enableSorting: spec.sortable ?? false,
    header: spec.sortable
      ? ({ column }) => (
          <SortableHeader
            label={spec.label}
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        )
      : () => <div className={alignClass(spec.align)}>{spec.label}</div>,
    cell: ({ row }) => (
      <div className={alignClass(spec.align)}>
        {formatCell(row.original[spec.field], spec, currency)}
      </div>
    ),
  }));
}

const FORMAT_TO_FIELDTYPE: Record<ColumnFormat, string> = {
  text: "Data",
  number: "Float",
  currency: "Currency",
  date: "Date",
  badge: "Data",
};

/** Derives `FilterPopover`'s required `DocFieldMeta[]` from whichever columns
 * declare `filterable: true` - the same declarative spec drives both cell
 * rendering and the filter builder's field/operator vocabulary, so the two
 * can never drift apart. */
export function buildFilterFields(columns: ColumnSpec[]): DocFieldMeta[] {
  return columns
    .filter((column) => column.filterable)
    .map((column) => ({
      fieldname: column.field,
      label: column.label,
      fieldtype:
        column.format === "badge" && column.filterOptions
          ? "Select"
          : FORMAT_TO_FIELDTYPE[column.format ?? "text"],
      options: column.filterOptions?.join("\n") ?? null,
      read_only: false,
      unique: false,
      permlevel: 0,
      in_list_view: true,
    }));
}
