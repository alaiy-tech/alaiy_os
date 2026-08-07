import { format } from "date-fns";

const EM_DASH = "—";

/** A bare Frappe `YYYY-MM-DD` rendered in the reader's locale.
 *
 * Split into parts and rebuilt through the local Date constructor rather than
 * handed to `new Date(string)`, which reads a date-only string as UTC midnight
 * and so prints the previous day for anyone west of Greenwich. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return EM_DASH;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return format(new Date(year, month - 1, day), "d MMM yyyy");
}

/** The first of these labels that actually says something.
 *
 * Frappe returns `""`, not null, for an unset Data field, so a blank has to
 * fall through the same way a null does — which is why this exists instead of
 * `??`, and why it is worth a named helper instead of a bare `||` that reads
 * like an oversight. */
export function labelOr(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

/** Quantities are Floats in ERPNext but whole units most of the time, so
 * trailing ".000" is dropped rather than padded onto every row. */
export function formatQty(value: number | null | undefined): string {
  const qty = value ?? 0;
  return qty.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function formatCurrency(
  amount: number,
  opts?: {
    currency?: string;
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    noDecimals?: boolean;
  },
) {
  const { currency = "USD", locale = "en-US", minimumFractionDigits, maximumFractionDigits, noDecimals } = opts ?? {};

  const formatOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    minimumFractionDigits: noDecimals ? 0 : minimumFractionDigits,
    maximumFractionDigits: noDecimals ? 0 : maximumFractionDigits,
  };

  return new Intl.NumberFormat(locale, formatOptions).format(amount);
}

/** A Frappe `YYYY-MM-DD HH:mm:ss[.ffffff]` rendered in the reader's locale.
 *
 * Frappe stores datetimes in the site's timezone with no offset on the string,
 * so the parts are fed to the local Date constructor rather than to
 * `new Date(string)` — which reads the same text as UTC in some browsers and as
 * local time in others, and would shift a log's timestamp by hours either way. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return EM_DASH;

  const [datePart, timePart = ""] = value.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return value;

  const [hour = 0, minute = 0, second = 0] = timePart.split(":").map((part) => Math.trunc(Number(part)) || 0);

  return format(new Date(year, month - 1, day, hour, minute, second), "d MMM yyyy, HH:mm:ss");
}
