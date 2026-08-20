"use client";
"use no memo";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";

import { GenericCell } from "@/components/generic-cell";
import type { DocFieldMeta } from "@/components/list/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DEFAULT_STATUS_BADGE_CLASS,
  ID_COLUMN_FIELDNAME,
  LABEL_OVERRIDES,
  STATUS_BADGE_CLASS,
} from "@/constants/purchase-orders";
import { isReceiptPastDue } from "@/lib/purchase-orders";
import { cn, formatFieldLabel } from "@/lib/utils";
import type { PurchaseOrderRow } from "@/types/purchase-orders";

export function getStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASS[status] ?? DEFAULT_STATUS_BADGE_CLASS;
}

/** Checkbox's tri-state, spelled out rather than built with `||` — the short-
 * circuit form returns `""` for an unselected page, which is not a CheckedState. */
function headerCheckedState(isAllSelected: boolean, isSomeSelected: boolean): boolean | "indeterminate" {
  if (isAllSelected) return true;
  return isSomeSelected ? "indeterminate" : false;
}

export function buildPurchaseOrderColumns({
  columnOrder,
  fieldsByName,
  currency,
  detailHref,
}: {
  columnOrder: string[];
  fieldsByName: Map<string, DocFieldMeta>;
  currency?: string;
  detailHref: (name: string) => string;
}): ColumnDef<PurchaseOrderRow>[] {
  const dynamicColumns: ColumnDef<PurchaseOrderRow>[] = columnOrder
    .filter((fieldname) => fieldname !== ID_COLUMN_FIELDNAME)
    .map((fieldname) => {
      const field = fieldsByName.get(fieldname);
      const label = LABEL_OVERRIDES[fieldname] ?? field?.label ?? formatFieldLabel(fieldname);

      if (fieldname === "status") {
        return {
          id: "status",
          accessorKey: "status",
          header: label,
          size: 150,
          cell: ({ getValue }) => {
            const status = String(getValue() ?? "");
            if (!status) return <span className="text-muted-foreground">—</span>;
            return (
              <Badge variant="outline" className={cn("border-0 font-medium", getStatusBadgeClass(status))}>
                {status}
              </Badge>
            );
          },
        };
      }

      if (fieldname === "schedule_date") {
        return {
          id: "schedule_date",
          accessorKey: "schedule_date",
          header: label,
          size: 160,
          cell: ({ getValue, row }) => {
            const value = getValue();
            if (!value) return <span className="text-muted-foreground">—</span>;

            const pastDue = isReceiptPastDue(value, row.original.status);
            return (
              <span
                className={cn(
                  "inline-flex rounded px-1.5 py-0.5",
                  pastDue && "bg-warning/15 font-medium text-warning-foreground",
                )}
                title={pastDue ? "Receipt is past due" : undefined}
              >
                <GenericCell value={value} fieldtype={field?.fieldtype ?? "Date"} currency={currency} />
              </span>
            );
          },
        };
      }

      return {
        id: fieldname,
        accessorKey: fieldname,
        header: label,
        size: 160,
        cell: ({ getValue }) => (
          <GenericCell value={getValue()} fieldtype={field?.fieldtype ?? "Data"} currency={currency} />
        ),
      };
    });

  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all orders"
          checked={headerCheckedState(table.getIsAllPageRowsSelected(), table.getIsSomePageRowsSelected())}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.name}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      ),
      enableHiding: false,
      enableSorting: false,
      enableResizing: false,
      size: 36,
    },
    {
      id: ID_COLUMN_FIELDNAME,
      accessorKey: ID_COLUMN_FIELDNAME,
      header: "PO #",
      size: 140,
      // A real link alongside the row-level click handler, so the order can be
      // opened in a new tab and reached by keyboard.
      cell: ({ getValue }) => {
        const name = String(getValue());
        return (
          <Link href={detailHref(name)} className="block truncate font-medium hover:underline" title={name}>
            {name}
          </Link>
        );
      },
      enableHiding: false,
    },
    ...dynamicColumns,
  ];
}
