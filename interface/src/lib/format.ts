/**
 * Presentation helpers for numbers on the dashboard.
 *
 * Pure and deterministic, so they give the same string on the server and in
 * the browser. That matters: `Intl` with an undefined locale resolves to the
 * runtime's own, which is the server's on the first paint and the viewer's
 * afterwards — React reports that as a hydration mismatch.
 */

/** Locale per currency, so grouping matches what a seller expects to read. */
const LOCALES: Record<string, string> = { INR: "en-IN" };
const DEFAULT_LOCALE = "en-US";

/** What the tiles show when there is no number, rather than a misleading 0. */
export const NO_VALUE = "—";

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NO_VALUE;
  return new Intl.NumberFormat(DEFAULT_LOCALE).format(Math.round(value));
}

export function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NO_VALUE;
  if (!currency) return formatNumber(value);

  const locale = LOCALES[currency] ?? DEFAULT_LOCALE;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      // Whole units once the figure is large enough that the paise are noise.
      maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
    }).format(value);
  } catch {
    // Intl throws RangeError on a currency code it does not know. A channel
    // could hand us anything, and a tile must still render.
    return `${currency} ${formatNumber(value)}`;
  }
}

export function formatPercent(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NO_VALUE;
  return `${value.toFixed(digits)}%`;
}

/**
 * A change, and which way it points.
 *
 * `direction: "none"` is not the same as `"flat"`. Flat means the number did
 * not move; none means there was no prior period to compare against, so no
 * arrow should be drawn and no percentage claimed.
 */
export type Delta = {
  label: string;
  direction: "up" | "down" | "flat" | "none";
};

const NO_BASELINE: Delta = { label: "no prior data", direction: "none" };

/** For a percentage change between two totals. */
export function percentDelta(change: number | null | undefined): Delta {
  if (change === null || change === undefined || Number.isNaN(change)) {
    return NO_BASELINE;
  }
  // Under a tenth of a percent reads as noise, and "+0.0%" invites a squint.
  if (Math.abs(change) < 0.05) return { label: "no change", direction: "flat" };
  const sign = change > 0 ? "+" : "−";
  return {
    label: `${sign}${Math.abs(change).toFixed(1)}%`,
    direction: change > 0 ? "up" : "down",
  };
}

/**
 * For the gap between two rates, which is percentage *points*.
 *
 * Calling this % would be wrong in a way that matters: a return rate moving
 * from 5% to 6% is up 1pp, not up 1%.
 */
export function pointDelta(change: number | null | undefined): Delta {
  if (change === null || change === undefined || Number.isNaN(change)) {
    return NO_BASELINE;
  }
  if (Math.abs(change) < 0.05) return { label: "no change", direction: "flat" };
  const sign = change > 0 ? "+" : "−";
  return {
    label: `${sign}${Math.abs(change).toFixed(1)}pp`,
    direction: change > 0 ? "up" : "down",
  };
}

/** "Last 7 days", and the shorter form used inside a sentence. */
export function windowLabel(days: number): string {
  if (days === 1) return "Today";
  if (days === 7) return "Last 7 days";
  if (days === 30) return "Last 30 days";
  return `Last ${days} days`;
}

/**
 * A date from the backend, rendered as the date alone.
 *
 * Deliberately string slicing rather than `new Date(...)`. Frappe sends a naive
 * "YYYY-MM-DD HH:MM:SS" in the site's own timezone; `Date` reads that as UTC
 * and would shift it — showing yesterday's date for an evening sync, and
 * disagreeing between the server render and the browser's. Neither the day nor
 * the timezone is worth guessing at, so this shows exactly what was sent.
 */
export function formatDate(value?: string | null): string {
  if (!value) return NO_VALUE;
  return value.slice(0, 10);
}

/**
 * The same value, to the minute.
 *
 * For "last update", where the day alone is not the answer — a seller asking
 * whether a stuck order moved this morning needs the time. String slicing for
 * the same reason as `formatDate`: Frappe sends a naive "YYYY-MM-DD HH:MM:SS"
 * in the site's own timezone, and parsing it as a Date would shift it and
 * disagree between the server render and the browser.
 */
export function formatDateTime(value?: string | null): string {
  if (!value) return NO_VALUE;
  const [date, time] = value.replace("T", " ").split(" ");
  if (!time) return date;
  return `${date} ${time.slice(0, 5)}`;
}
