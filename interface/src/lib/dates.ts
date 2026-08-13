/** Today as `YYYY-MM-DD` in the viewer's own timezone. */
export function todayIso(): string {
  return toDateParam(new Date());
}

/** `YYYY-MM-DD`, the format Frappe Date fields arrive in and the one the list
 * queries expect back. Built from local parts rather than toISOString(), which
 * converts to UTC first and can hand back the previous day. */
export function toDateParam(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whether a document's due date has passed while it is still open.
 *
 * Compared as strings: both sides are zero-padded `YYYY-MM-DD`, so
 * lexicographic order is date order, and no timezone is involved — parsing a
 * bare Frappe date into a Date would place it at UTC midnight and shift the
 * comparison by a day for anyone west of Greenwich.
 *
 * `settledStatuses` is the list of statuses that close the document out; the
 * per-doctype wrappers (isDeliveryPastDue, isReceiptPastDue) each pass their
 * own, and each of those mirrors a SETTLED_STATUSES on the Python side so the
 * highlighted cells are exactly the rows the past-due KPI counts. */
export function isPastDue(dueDate: unknown, status: unknown, settledStatuses: readonly string[]): boolean {
  if (typeof dueDate !== "string" || !dueDate) return false;
  if (typeof status === "string" && settledStatuses.includes(status)) return false;
  return dueDate < todayIso();
}
