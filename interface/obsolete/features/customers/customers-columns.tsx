import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { UserRound } from "lucide-react";

import {
  CUSTOMER_STATUS_TONE,
  type CustomerRow,
} from "@/app/(main)/os/customers/_components/customers-table/schema";
import type { DocFieldMeta } from "@/components/list/types";
import { Badge } from "@/components/primitive/badge";
import { cn } from "@/lib/utils";

export type { CustomerRow } from "@/app/(main)/os/customers/_components/customers-table/schema";
export { toCustomerRow } from "@/app/(main)/os/customers/_components/customers-table/schema";

/** Column defs for the headless Customers roster table (rendered via
 * `os-data-table`, not `/os/customers`'s bespoke `Customers` component - see
 * `UI_RUNTIME.md`). Reuses `/os/customers`'s existing `CustomerRow`/
 * `toCustomerRow`/`CUSTOMER_STATUS_TONE` (pure, dependency-free modules) so
 * the row shape and status colours are identical - only the surrounding
 * table chrome (filter/search/columns UI) differs. */

function orDash(value: string | null) {
  return value ? value : <span className="text-muted-foreground">—</span>;
}

export const customersColumns: ColumnDef<CustomerRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Customer",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {row.original.image ? (
            // Plain <img>, not next/image: served by Frappe, and no-referrer
            // for the same reason /os/customers's own column does this.
            <img
              src={row.original.image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          ) : (
            <UserRound className="size-4 text-muted-foreground" />
          )}
        </span>
        <div className="grid min-w-0 gap-0.5">
          <span className="truncate font-medium text-sm leading-none">
            {row.original.name}
          </span>
          <span className="truncate text-muted-foreground text-xs leading-none">
            {row.original.id}
          </span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={cn(
          "border-0 font-medium",
          CUSTOMER_STATUS_TONE[row.original.status],
        )}
      >
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "group",
    header: "Group",
    cell: ({ row }) => orDash(row.original.group),
  },
  {
    accessorKey: "territory",
    header: "Territory",
    cell: ({ row }) => orDash(row.original.territory),
  },
  {
    accessorKey: "orders",
    header: () => <div className="text-right">Orders</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {row.original.orders.toLocaleString()}
      </div>
    ),
  },
  {
    accessorKey: "spend",
    header: () => <div className="text-right">Total Spend</div>,
    sortingFn: (a, b) => a.original.spendValue - b.original.spendValue,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{row.original.spend}</div>
    ),
  },
  {
    accessorKey: "lastOrder",
    header: "Last Order",
    cell: ({ row }) =>
      row.original.lastOrder ? (
        format(parseISO(row.original.lastOrder), "do MMM yyyy")
      ) : (
        <span className="text-muted-foreground">Never</span>
      ),
  },
  {
    accessorKey: "joined",
    header: "Joined",
    cell: ({ row }) => format(parseISO(row.original.joined), "do MMMM yyyy"),
  },
];

export const customersFilterFields: DocFieldMeta[] = [
  {
    fieldname: "name",
    label: "Name",
    fieldtype: "Data",
    options: null,
    read_only: false,
    unique: false,
    permlevel: 0,
    in_list_view: true,
  },
  {
    fieldname: "status",
    label: "Status",
    fieldtype: "Select",
    options: "Active\nNo Orders\nDisabled",
    read_only: false,
    unique: false,
    permlevel: 0,
    in_list_view: true,
  },
  {
    fieldname: "group",
    label: "Group",
    fieldtype: "Data",
    options: null,
    read_only: false,
    unique: false,
    permlevel: 0,
    in_list_view: true,
  },
  {
    fieldname: "territory",
    label: "Territory",
    fieldtype: "Data",
    options: null,
    read_only: false,
    unique: false,
    permlevel: 0,
    in_list_view: true,
  },
  {
    fieldname: "orders",
    label: "Orders",
    fieldtype: "Int",
    options: null,
    read_only: false,
    unique: false,
    permlevel: 0,
    in_list_view: true,
  },
  {
    fieldname: "joined",
    label: "Joined",
    fieldtype: "Date",
    options: null,
    read_only: false,
    unique: false,
    permlevel: 0,
    in_list_view: true,
  },
];
