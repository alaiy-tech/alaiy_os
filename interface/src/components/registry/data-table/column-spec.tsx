import type { ReactNode } from "react";

import type { ColumnDef } from "@tanstack/react-table";
import { format as formatDate, parseISO } from "date-fns";
import { ArrowUpDown } from "lucide-react";

import type { DocFieldMeta } from "@/components/derived/list/types";
import { Button } from "@/components/primitive/button";
import { DynamicBadge } from "@/components/registry/dynamic-badge";
import { formatCurrency, formatFieldValue } from "@/utils/format";
import type { ERPNextBadgeCategory } from "@/utils/get-badge-style";

/**
 * The `data-table` capability contract's column shape (brief §20) - plain,
 * JSON-safe data (no render functions), so it can live directly in a page's
 * `props.columns` and cross the Server -> Client boundary like any other
 * prop. `buildColumnDefs` turns this into real TanStack `ColumnDef`s
 * *inside* the client component that consumes it - the function-building
 * step never crosses a boundary, only the plain spec does.
 *
 * `columns` is the *default/initial visible set*, rendered with rich,
 * per-format cells - it is no longer also the universe of what the filter
 * and column popovers may offer. That universe is the doctype's own field
 * list (`DataDefinition.exposeFields`, resolved as `fields` -
 * `buildExtraColumnDefs` below folds it in as generic columns, which
 * `OsDataTable` then discovers the same way it discovers every other
 * column).
 */
export type ColumnFormat = "text" | "number" | "currency" | "date" | "badge";

export type ColumnTextStyle =
  | "bold"
  | "semibold"
  | "medium"
  | "italic"
  | "underline";

export type ColumnSpec = {
  field: string;
  label: string;
  format?: ColumnFormat;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  /** `format: "badge"` only - which `os-dynamic-badge` category resolves the
   * value's colour (`utils/get-badge-style.ts`). Omitted falls back to
   * `"generic"`, which still auto-matches a value found in any category's
   * map before giving up to a neutral tone. */
  badgeCategory?: ERPNextBadgeCategory;
  /** Can never be removed via the column picker, regardless of how many
   * columns are currently visible - e.g. an id/name column. Distinct from
   * `minVisibleColumns` (a table-level floor on *how many* stay visible;
   * this is "this *specific* one always does"). */
  compulsory?: boolean;
  /** Text styling applied to this column's *cell values* only, never its
   * header - e.g. `["bold", "underline"]`. Optional; when present it must
   * list at least one style (`config/component-props-schema.ts` rejects an
   * empty array - there's nothing to opt into, just omit the prop). */
  textStyle?: ColumnTextStyle[];
  width?: number;
};

function alignClass(align: ColumnSpec["align"]): string | undefined {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return undefined;
}

function textStyleClass(
  textStyle: ColumnSpec["textStyle"],
): string | undefined {
  if (!textStyle || textStyle.length === 0) return undefined;
  return [
    textStyle.includes("bold") && "font-bold",
    textStyle.includes("semibold") && "font-semibold",
    textStyle.includes("medium") && "font-medium",
    textStyle.includes("italic") && "italic",
    textStyle.includes("underline") && "underline",
  ]
    .filter(Boolean)
    .join(" ");
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
    case "badge":
      return (
        <DynamicBadge
          content={String(value)}
          category={spec.badgeCategory ?? "generic"}
        />
      );
    default:
      return String(value);
  }
}

function SortableHeader({
  label,
  align,
  onClick,
}: {
  label: string;
  align: ColumnSpec["align"];
  onClick: () => void;
}) {
  return (
    <div className={alignClass(align)}>
      <Button
        variant="ghost"
        className={align === "right" ? "-mr-3" : "-ml-3"}
        onClick={onClick}
      >
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
  return columns.map((spec) => {
    // The *actual last visible* column's header right-aligns by default -
    // not necessarily this column, and not a fixed authored-order decision,
    // since column-visibility/reordering can change which column ends up
    // last after this table renders. That default is enforced dynamically
    // at the table level instead (`data-table.tsx`, via an inherited
    // `text-align` on the outer `<TableHead>`/`<TableCell>`) - an explicit
    // `spec.align` here still always wins, since it sets `text-align`
    // directly on this cell's own inner `<div>` rather than relying on
    // inheritance.
    const effectiveAlign = spec.align;

    return {
      id: spec.field,
      accessorKey: spec.field,
      // Every header here renders as JSX (for alignment), not a plain
      // string - `meta.label` is what `columnFieldsFrom` (data-table.tsx)
      // reads for the column picker/filter popover instead.
      meta: { label: spec.label },
      enableSorting: spec.sortable ?? false,
      header: spec.sortable
        ? ({ column }) => (
            <SortableHeader
              label={spec.label}
              align={effectiveAlign}
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            />
          )
        : () => <div className={alignClass(effectiveAlign)}>{spec.label}</div>,
      cell: ({ row }) => (
        <div className={alignClass(effectiveAlign)}>
          <span className={textStyleClass(spec.textStyle)}>
            {formatCell(row.original[spec.field], spec, currency)}
          </span>
        </div>
      ),
    };
  });
}

/** Every `compulsory` column's `field`, derived straight from `columns` so
 * an author marks a column compulsory in exactly one place instead of also
 * having to keep a separate `compulsoryColumns` array in sync by hand. */
export function buildCompulsoryColumns(columns: ColumnSpec[]): string[] {
  return columns
    .filter((column) => column.compulsory)
    .map((column) => column.field);
}

/** One generic, fieldtype-keyed column per doctype field that isn't already
 * an authored column and isn't excluded - the same "no per-domain
 * special-casing, just the fieldtype" rendering `settings/logs` already uses
 * (`formatFieldValue`). This is what lets the column picker's "Add Fields"
 * entries actually render something once picked, without every possible
 * doctype field needing its own hand-authored `ColumnSpec`. */
export function buildExtraColumnDefs<TRow extends Record<string, unknown>>(
  columns: ColumnSpec[],
  fields: DocFieldMeta[],
  excludedFields: string[] = [],
): ColumnDef<TRow, unknown>[] {
  const authored = new Set(columns.map((column) => column.field));
  const excluded = new Set(excludedFields);

  return fields
    .filter(
      (field) =>
        !authored.has(field.fieldname) && !excluded.has(field.fieldname),
    )
    .map((field) => ({
      id: field.fieldname,
      accessorKey: field.fieldname,
      meta: { label: field.label },
      header: () => <div>{field.label}</div>,
      cell: ({ row }) => (
        <div>
          {formatFieldValue(row.original[field.fieldname], field.fieldtype)}
        </div>
      ),
    }));
}
