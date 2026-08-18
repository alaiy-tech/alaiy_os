"use client";
"use no memo";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";

import { GenericCell } from "@/components/generic-cell";
import type { DocFieldMeta } from "@/components/list/types";
import { Badge } from "@/components/primitive/badge";
import { Checkbox } from "@/components/primitive/checkbox";
import { productExtension } from "@/config/product-extension";
import { isNumericFieldtype } from "@/constants/list";
import {
  ID_COLUMN_FIELDNAME,
  IMAGE_COLUMN_FIELDNAME,
  ITEM_CODE_COLUMN_FIELDNAME,
  ITEM_IMAGE_REFERRER_POLICY,
  STATUS_BADGE_CLASS,
} from "@/constants/products";
import { getProductStatus } from "@/lib/products";
import { cn, formatFieldLabel } from "@/lib/utils";
import type { ProductRow } from "@/types/products";

import { hasProductChildren } from "./product-child-rows";

function ItemNameCell({
  row,
  showItemCode,
  href,
}: {
  row: ProductRow;
  showItemCode: boolean;
  href: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {row.image ? (
          <img
            src={String(row.image)}
            alt={row.item_name}
            loading="lazy"
            referrerPolicy={ITEM_IMAGE_REFERRER_POLICY}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-[10px] text-muted-foreground">No img</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <Link
          href={href}
          className="block truncate font-medium hover:underline"
          title={row.item_name}
        >
          {row.item_name}
        </Link>
        {showItemCode && row.item_code && (
          <span
            className="block truncate text-muted-foreground text-xs"
            title={row.item_code}
          >
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
  currency,
  detailHref,
}: {
  columnOrder: string[];
  fieldsByName: Map<string, DocFieldMeta>;
  expandedIds: Set<string>;
  onToggleExpand: (row: ProductRow) => void;
  currency?: string;
  detailHref: (name: string) => string;
}): ColumnDef<ProductRow>[] {
  const showItemCode = columnOrder.includes(ITEM_CODE_COLUMN_FIELDNAME);

  const dynamicColumns: ColumnDef<ProductRow>[] = columnOrder
    .filter(
      (fieldname) =>
        fieldname !== IMAGE_COLUMN_FIELDNAME &&
        fieldname !== ITEM_CODE_COLUMN_FIELDNAME &&
        fieldname !== ID_COLUMN_FIELDNAME,
    )
    .map((fieldname) => {
      const field = fieldsByName.get(fieldname);
      const label = field?.label ?? formatFieldLabel(fieldname);

      if (fieldname === "status") {
        return {
          id: "status",
          header: "Status",
          size: 120,
          cell: ({ row }) => {
            // A contributing app whose Frappe side reshapes Item decides what a
            // status means there; null means it has no opinion on this row and
            // the base's own derivation stands.
            const contributed = productExtension?.status?.(row.original);
            if (contributed) {
              return (
                <Badge
                  variant="outline"
                  className={cn(
                    "border-0 font-medium",
                    contributed.className ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {contributed.label}
                </Badge>
              );
            }
            const status = getProductStatus(row.original);
            return (
              <Badge
                variant="outline"
                className={cn(
                  "border-0 font-medium",
                  STATUS_BADGE_CLASS[status],
                )}
              >
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
          cell: ({ row }) => (
            <ItemNameCell
              row={row.original}
              showItemCode={showItemCode}
              href={detailHref(row.original.name)}
            />
          ),
        };
      }

      return {
        id: fieldname,
        accessorKey: fieldname,
        header: label,
        size: 160,
        // Numbers a user scans down a column read better flush right, where
        // tabular-nums can line the digits up against each other.
        meta: isNumericFieldtype(field?.fieldtype)
          ? { align: "right" as const }
          : undefined,
        cell: ({ getValue }) => (
          <GenericCell
            value={getValue()}
            fieldtype={field?.fieldtype ?? "Data"}
            currency={currency}
          />
        ),
      };
    });

  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all products"
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
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
        hasProductChildren(row.original) ? (
          <button
            type="button"
            onClick={() => onToggleExpand(row.original)}
            aria-label={
              expandedIds.has(row.original.name)
                ? "Collapse variants"
                : "Expand variants"
            }
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                "size-4 transition-transform",
                expandedIds.has(row.original.name) && "rotate-90",
              )}
            />
          </button>
        ) : null,
      enableHiding: false,
      enableSorting: false,
      enableResizing: false,
      size: 32,
    },
    {
      id: ID_COLUMN_FIELDNAME,
      accessorKey: ID_COLUMN_FIELDNAME,
      header: "ID",
      size: 140,
      // A real link alongside the row-level click handler, so the item can be
      // opened in a new tab and reached by keyboard.
      cell: ({ getValue }) => {
        const name = String(getValue());
        return (
          <Link
            href={detailHref(name)}
            className="block truncate font-medium hover:underline"
            title={name}
          >
            {name}
          </Link>
        );
      },
      enableHiding: false,
    },
    ...dynamicColumns,
  ];
}
