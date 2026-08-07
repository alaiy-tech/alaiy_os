"use client";
"use no memo";

import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";

import type { DocFieldMeta } from "@/components/list/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, formatFieldLabel } from "@/lib/utils";

import {
  getProductStatus,
  IMAGE_COLUMN_FIELDNAME,
  ITEM_CODE_COLUMN_FIELDNAME,
  type ProductRow,
  STATUS_BADGE_CLASS,
} from "./product-types";

function GenericCell({ value, fieldtype }: { value: unknown; fieldtype: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (fieldtype === "Check") {
    return <span>{value ? "Yes" : "No"}</span>;
  }
  if (["Int", "Float", "Currency", "Percent"].includes(fieldtype)) {
    return <span className="tabular-nums">{Number(value).toLocaleString()}</span>;
  }
  return (
    <span className="block truncate" title={String(value)}>
      {String(value)}
    </span>
  );
}

function ItemNameCell({ row, showItemCode }: { row: ProductRow; showItemCode: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {row.image ? (
          <img src={String(row.image)} alt={row.item_name} className="size-full object-cover" />
        ) : (
          <span className="text-[10px] text-muted-foreground">No img</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="block truncate font-medium" title={row.item_name}>
          {row.item_name}
        </span>
        {showItemCode && row.item_code && (
          <span className="block truncate text-muted-foreground text-xs" title={row.item_code}>
            {row.item_code}
          </span>
        )}
      </div>
    </div>
  );
}

export function buildProductColumns({
  columnOrder,
  fieldsByName,
  expandedIds,
  onToggleExpand,
}: {
  columnOrder: string[];
  fieldsByName: Map<string, DocFieldMeta>;
  expandedIds: Set<string>;
  onToggleExpand: (row: ProductRow) => void;
}): ColumnDef<ProductRow>[] {
  const showItemCode = columnOrder.includes(ITEM_CODE_COLUMN_FIELDNAME);

  const dynamicColumns: ColumnDef<ProductRow>[] = columnOrder
    .filter((fieldname) => fieldname !== IMAGE_COLUMN_FIELDNAME && fieldname !== ITEM_CODE_COLUMN_FIELDNAME)
    .map((fieldname) => {
      const field = fieldsByName.get(fieldname);
      const label = field?.label ?? formatFieldLabel(fieldname);

      if (fieldname === "status") {
        return {
          id: "status",
          header: "Status",
          size: 120,
          cell: ({ row }) => {
            const status = getProductStatus(row.original);
            return (
              <Badge variant="outline" className={cn("border-0 font-medium", STATUS_BADGE_CLASS[status])}>
                {status}
              </Badge>
            );
          },
        };
      }

      if (fieldname === "item_name") {
        return {
          id: "item_name",
          accessorKey: "item_name",
          header: label,
          size: 240,
          cell: ({ row }) => <ItemNameCell row={row.original} showItemCode={showItemCode} />,
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
          aria-label="Select all products"
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.item_name}`}
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
      id: "expand",
      header: "",
      cell: ({ row }) =>
        row.original.has_variants ? (
          <button
            type="button"
            onClick={() => onToggleExpand(row.original)}
            aria-label={expandedIds.has(row.original.name) ? "Collapse variants" : "Expand variants"}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight
              className={cn("size-4 transition-transform", expandedIds.has(row.original.name) && "rotate-90")}
            />
          </button>
        ) : null,
      enableHiding: false,
      enableSorting: false,
      enableResizing: false,
      size: 32,
    },
    ...dynamicColumns,
  ];
}
