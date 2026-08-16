import type { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";

import type { DocFieldMeta } from "@/components/list/types";
import { STATUS_TONE } from "@/constants/list";
import { cn, formatCurrency } from "@/lib/utils";
import type { RecentOrder, RecentOrderFulfillment, RecentOrderPayment } from "@/types/dashboard";

/** Column defs + row mapping for the headless dashboard's Recent Orders
 * table (rendered via the shared `os-data-table` / `OsDataTable`, not the
 * bespoke `RecentOrders` component `/os` uses - see `UI_RUNTIME.md` for why).
 * `payment`/`fulfillment` are split into two independently filterable
 * columns here (rather than `/os`'s combined "statusSummary" toggle column)
 * so each is a real field `OsDataTable`'s generic `FilterPopover` mechanism
 * can filter on - a disclosed adaptation, not a fidelity bug. */

export type RecentOrderRow = {
  id: string;
  date: string;
  customer: string;
  payment: RecentOrderPayment;
  fulfillment: RecentOrderFulfillment;
  total: string;
  items: string;
};

const PAYMENT_TONE: Record<RecentOrderPayment, string> = {
  Paid: STATUS_TONE.success,
  Pending: STATUS_TONE.warning,
  Refunded: STATUS_TONE.destructive,
};

const FULFILLMENT_TONE: Record<RecentOrderFulfillment, string> = {
  Fulfilled: STATUS_TONE.success,
  Unfulfilled: STATUS_TONE.caution,
  Returned: STATUS_TONE.destructive,
};

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs", tone)}>{label}</span>
  );
}

export function toRecentOrderRow(order: RecentOrder, defaultCurrency?: string): RecentOrderRow {
  const itemCount = Math.round(order.item_count);

  return {
    id: order.name,
    date: order.creation.replace(" ", "T"),
    customer: order.customer_name,
    payment: order.payment,
    fulfillment: order.fulfillment,
    total: formatCurrency(order.grand_total, { currency: order.currency ?? defaultCurrency }),
    items: `${itemCount.toLocaleString()} ${itemCount === 1 ? "item" : "items"}`,
  };
}

export const recentOrdersColumns: ColumnDef<RecentOrderRow, unknown>[] = [
  {
    accessorKey: "id",
    header: "Order",
    cell: ({ row }) => (
      <div className="flex flex-col gap-0.5">
        <div className="font-medium leading-none">{row.original.id}</div>
        <div className="text-muted-foreground text-xs">{row.original.items}</div>
      </div>
    ),
  },
  { accessorKey: "customer", header: "Customer" },
  {
    accessorKey: "payment",
    header: "Payment",
    cell: ({ row }) => <StatusBadge label={row.original.payment} tone={PAYMENT_TONE[row.original.payment]} />,
  },
  {
    accessorKey: "fulfillment",
    header: "Fulfillment",
    cell: ({ row }) => (
      <StatusBadge label={row.original.fulfillment} tone={FULFILLMENT_TONE[row.original.fulfillment]} />
    ),
  },
  {
    accessorKey: "total",
    header: () => <div className="w-28">Total</div>,
    cell: ({ row }) => <div className="w-28 tabular-nums">{row.original.total}</div>,
  },
  {
    accessorKey: "date",
    header: () => <div className="w-44">Date</div>,
    cell: ({ row }) => (
      <div className="w-44 text-muted-foreground">{format(parseISO(row.original.date), "h:mm a, d MMM yyyy")}</div>
    ),
  },
];

export const recentOrdersFilterFields: DocFieldMeta[] = [
  {
    fieldname: "customer",
    label: "Customer",
    fieldtype: "Data",
    options: null,
    read_only: false,
    unique: false,
    permlevel: 0,
    in_list_view: true,
  },
  {
    fieldname: "payment",
    label: "Payment",
    fieldtype: "Select",
    options: "Paid\nPending\nRefunded",
    read_only: false,
    unique: false,
    permlevel: 0,
    in_list_view: true,
  },
  {
    fieldname: "fulfillment",
    label: "Fulfillment",
    fieldtype: "Select",
    options: "Fulfilled\nUnfulfilled\nReturned",
    read_only: false,
    unique: false,
    permlevel: 0,
    in_list_view: true,
  },
];
