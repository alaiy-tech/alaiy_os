import { SETTLED_STATUSES } from "@/constants/sales-orders";

/** Today as `YYYY-MM-DD` in the viewer's own timezone. */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** `YYYY-MM-DD`, the format Frappe Date fields arrive in and the one the
 * list query expects back. Built from local parts rather than toISOString(),
 * which converts to UTC first and can hand back the previous day. */
export function toDateParam(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whether an order's delivery date has passed while it can still be
 * delivered. Compared as strings: both sides are zero-padded `YYYY-MM-DD`,
 * so lexicographic order is date order, and no timezone is involved — parsing
 * a bare Frappe date into a Date would place it at UTC midnight and shift the
 * comparison by a day for anyone west of Greenwich.
 *
 * The settled-status rule mirrors the Past-due Deliveries KPI in
 * alaiy_os/api/sales_order_stats.py; the highlighted cells are meant to be
 * exactly the orders that figure counts. */
export function isDeliveryPastDue(deliveryDate: unknown, status: unknown): boolean {
  if (typeof deliveryDate !== "string" || !deliveryDate) return false;
  if (typeof status === "string" && SETTLED_STATUSES.includes(status)) return false;
  return deliveryDate < todayIso();
}
