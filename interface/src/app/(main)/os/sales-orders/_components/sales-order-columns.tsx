"use client";
"use no memo";

import type { ColumnDef } from "@tanstack/react-table";

import { GenericCell } from "@/components/list/generic-cell";
import type { DocFieldMeta } from "@/components/list/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DEFAULT_STATUS_BADGE_CLASS,
  ID_COLUMN_FIELDNAME,
  LABEL_OVERRIDES,
  STATUS_BADGE_CLASS,
} from "@/constants/sales-orders";
import { cn, formatFieldLabel } from "@/lib/utils";
import type { SalesOrderRow } from "@/types/sales-orders";

export function getStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASS[status] ?? DEFAULT_STATUS_BADGE_CLASS;
}

export function buildSalesOrderColumns({
  columnOrder,
  fieldsByName,
}: {
  columnOrder: string[];
  fieldsByName: Map<string, DocFieldMeta>;
}): ColumnDef<SalesOrderRow>[] {
  const dynamicColumns: ColumnDef<SalesOrderRow>[] = columnOrder.map((fieldname) => {
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

    return {
      id: fieldname,
      accessorKey: fieldname,
      header: label,
      size: 160,
      cell: ({ getValue }) => <GenericCell value={getValue()} fieldtype={field?.fieldtype ?? "Data"} />,
    };
  });

  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all orders"
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
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
      header: "ID",
      size: 140,
      cell: ({ getValue }) => (
        <span className="block truncate font-medium" title={String(getValue())}>
          {String(getValue())}
        </span>
      ),
      enableHiding: false,
    },
    ...dynamicColumns,
  ];
}
