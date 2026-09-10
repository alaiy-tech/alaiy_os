/**
 * Arithmetic on the naive "YYYY-MM-DD" dates the app keeps everywhere (see
 * the note on `formatDate` in `lib/format.ts`) — parsed as local calendar
 * dates rather than through `Date`'s own UTC parsing, which would shift a
 * date by a day depending on the reader's timezone.
 *
 * One function, because one tab still counts days from a plain date string.
 * `isoDate`, `daysBetween` and `withinDays` went with the Support tab and the
 * mock data that fed them — every remaining date on screen is formatted or
 * compared by the backend that produced it.
 */

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/**
 * Whole calendar days from `today` until a future YYYY-MM-DD date.
 *
 * Negative once the date has passed, and deliberately not clamped: the
 * Inventory tab asks "does this PO land before I run out", and both a late
 * arrival and an overdue one are real answers.
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
