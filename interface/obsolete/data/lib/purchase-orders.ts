import { SETTLED_STATUSES } from "@/constants/purchase-orders";
import { isPastDue } from "./dates";

export { toDateParam, todayIso } from "@/lib/dates";

/** Whether an order's required-by date has passed while it can still be
 * received. The settled-status rule mirrors SETTLED_STATUSES in
 * alaiy_os/api/purchase_order_stats.py; the highlighted cells are meant to be
 * exactly the orders the Past-due Receipts KPI counts. */
export function isReceiptPastDue(scheduleDate: unknown, status: unknown): boolean {
  return isPastDue(scheduleDate, status, SETTLED_STATUSES);
}

/** How much of a line is still to come in, floored at zero — an over-receipt
 * (ERPNext allows one within tolerance) is not a negative outstanding. */
export function outstandingQty(qty: number, receivedQty: number): number {
  return Math.max(qty - receivedQty, 0);
}
