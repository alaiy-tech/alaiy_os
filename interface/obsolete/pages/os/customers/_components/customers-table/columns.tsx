"use client";
"use no memo";

import type { ColumnDef } from "@tanstack/react-table";
import {
  differenceInCalendarDays,
  endOfToday,
  format,
  parseISO,
} from "date-fns";
import { UserRound } from "lucide-react";

import { Badge } from "@/components/primitive/badge";
import { Checkbox } from "@/components/primitive/checkbox";
import { cn } from "@/lib/utils";

import { CUSTOMER_STATUS_TONE, type CustomerRow } from "./schema";

/** An unset Link or Read Only field comes back empty; a dash reads better down
 * a column than a blank cell, which looks like a rendering failure. */
function orDash(value: string | null) {
  return value ? value : <span className="text-muted-foreground">—</span>;
}

export const customersColumns: ColumnDef<CustomerRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all customers on this page"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={`Select ${row.original.name}`}
        />
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Customer",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {row.original.image ? (
            // Plain <img>, not next/image: the file is served by Frappe, and
            // no-referrer for the same reason ITEM_IMAGE_REFERRER_POLICY gives
            // — an uploaded image may point off-site, and the OS URL is not
            // the referrer to hand it.
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
          {/* The docname, which on a series-named site is the only thing that
              identifies the record - and differs from the display name. */}
          <span className="truncate text-muted-foreground text-xs leading-none">
            {row.original.id}
          </span>
        </div>
      </div>
    ),
    enableHiding: false,
  },
  {
    id: "search",
    accessorFn: (row) => `${row.id} ${row.name} ${row.email ?? ""}`,
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: "equalsString",
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
    cell: ({ row }) => (
      <span className="text-sm">{orDash(row.original.group)}</span>
    ),
  },
  {
    accessorKey: "territory",
    header: "Territory",
    cell: ({ row }) => (
      <span className="text-sm">{orDash(row.original.territory)}</span>
    ),
  },
  {
    accessorKey: "orders",
    header: "Orders",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">
        {row.original.orders.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "spend",
    header: "Total Spend",
    meta: { align: "right" },
    // Sorts on the underlying figure, not the formatted string - "$9" must
    // not sort above "$10" because "9" > "1" as text.
    sortingFn: (a, b) => a.original.spendValue - b.original.spendValue,
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">{row.original.spend}</span>
    ),
  },
  {
    accessorKey: "lastOrder",
    header: "Last Order",
    cell: ({ row }) =>
      row.original.lastOrder ? (
        <span className="text-sm">
          {format(parseISO(row.original.lastOrder), "do MMM yyyy")}
        </span>
      ) : (
        <span className="text-muted-foreground text-sm">Never</span>
      ),
  },
  {
    id: "joinedWindow",
    accessorFn: (row) => {
      const daysSinceJoined = differenceInCalendarDays(
        endOfToday(),
        parseISO(row.joined),
      );

      if (daysSinceJoined <= 30) return ["30", "90"];
      if (daysSinceJoined <= 90) return ["90"];
      return [];
    },
    filterFn: "arrIncludes",
    enableHiding: true,
  },
  {
    accessorKey: "joined",
    header: "Joined",
    cell: ({ row }) => {
      const joinedAt = parseISO(row.original.joined);

      return (
        <div className="grid gap-0.5">
          <span className="text-sm">{format(joinedAt, "do MMMM yyyy")}</span>
          <span className="text-muted-foreground text-xs">
            at {format(joinedAt, "h:mm a")}
          </span>
        </div>
      );
    },
  },
];
