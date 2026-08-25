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
