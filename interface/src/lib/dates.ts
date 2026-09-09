/**
 * Arithmetic on the naive "YYYY-MM-DD" dates the app keeps everywhere (see
 * the note on `formatDate` in `lib/format.ts`) — parsed as local calendar
 * dates rather than through `Date`'s own UTC parsing, which would shift a
 * date by a day depending on the reader's timezone.
 *
 * Shared by the Support and Ratings tabs, both of which score how long
 * something has been sitting from a plain date string.
 */

export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/**
 * Whole calendar days from `today` until a future YYYY-MM-DD date.
 *
 * Negative once the date has passed, and deliberately not clamped the way
 * `daysBetween` is: the Inventory tab asks "does this PO land before I run
 * out", and both a late arrival and an overdue one are real answers.
 *
 * Compared at local midnight on both sides. Diffing a date against a *time*
 * loses a day whenever the clock is past midnight — which is always — so a PO
 * six days out read as five and the tab under-reported how late it was.
 */
export function daysUntil(date: string, today: Date): number {
  const target = parseLocalDate(date);
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** Whole days between two YYYY-MM-DD dates, ignoring time of day. */
export function daysBetween(from: string, today: Date): number {
  const start = parseLocalDate(from);
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function withinDays(date: string, today: Date, days: number): boolean {
  return daysBetween(date, today) <= days;
}
