import { todayIso } from "@/lib/dates";

/** Whether a document's due date has passed while it is still open.
 *
 * Compared as strings: both sides are zero-padded `YYYY-MM-DD`, so
 * lexicographic order is date order, and no timezone is involved — parsing a
 * bare Frappe date into a Date would place it at UTC midnight and shift the
 * comparison by a day for anyone west of Greenwich.
 *
 * `settledStatuses` is the list of statuses that close the document out; the
 * per-doctype wrappers (isDeliveryPastDue, isReceiptPastDue - see
 * obsolete/data/lib/sales-orders.ts and purchase-orders.ts) each pass their
 * own, and each of those mirrors a SETTLED_STATUSES on the Python side so the
 * highlighted cells are exactly the rows the past-due KPI counts. Moved here
 * alongside its only callers when Sales/Purchase Orders were retired in
 * Round 4 - see obsolete/README.md. */
export function isPastDue(dueDate: unknown, status: unknown, settledStatuses: readonly string[]): boolean {
  if (typeof dueDate !== "string" || !dueDate) return false;
  if (typeof status === "string" && settledStatuses.includes(status)) return false;
  return dueDate < todayIso();
}
