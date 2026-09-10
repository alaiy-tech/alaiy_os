import type { CarrierExceptions, CarrierRow, ShippingMetric } from "./types";

/**
 * How a shipping figure reads: which direction is an improvement, and how a
 * number that could not be computed is told apart from a bad one.
 *
 * Client-safe, like the equivalent file for Ratings — the tone on a trend
 * arrow has to be readable wherever the figure is shown.
 */

/** Amazon opens an Account Health review here. The backend sends its own copy
 *  on the summary; this is the fallback for rendering before that arrives. */
export const LATE_SHIPMENT_RATE_THRESHOLD = 4.0;

/** Under this many measured parcels, a percentage describes the sample rather
 *  than the business. Matches MIN_CARRIER_SHIPMENTS on the backend. */
export const THIN_SAMPLE = 5;

export type Trend = {
  label: string;
  direction: "up" | "down" | "flat";
  /** "up" is not always good — a lower Late Shipment Rate is the win. */
  tone: "ok" | "alert" | "neutral";
} | null;

/**
 * A metric's trend against the window before it.
 *
 * Null when either end is missing, and that is the point: a tab that showed
 * "no change" for a metric it could not compute last week would claim a
 * stability it never observed. The tile renders nothing rather than that.
 *
 * Whether a rise is good depends on the metric — handling time and Late
 * Shipment Rate want to fall, the two on-time rates want to rise — so tone
 * comes from `higherIsBetter` rather than a rise always reading as progress.
 */
export function trendFor(
  metric: ShippingMetric,
  opts: { higherIsBetter: boolean; unit: "h" | "pp"; digits?: number },
): Trend {
  const { higherIsBetter, unit, digits = 1 } = opts;
  if (metric.value === null || metric.previous === null) return null;

  const change = metric.value - metric.previous;
  if (Math.abs(change) < 0.05) return { label: "no change", direction: "flat", tone: "neutral" };

  const direction = change > 0 ? "up" : "down";
  const good = higherIsBetter ? direction === "up" : direction === "down";
  const sign = change > 0 ? "+" : "−";
  return {
    label: `${sign}${Math.abs(change).toFixed(digits)}${unit}`,
    direction,
    tone: good ? "ok" : "alert",
  };
}

/** Every exception type in one figure, for a compact table cell. */
export function exceptionCount(exceptions: CarrierExceptions): number {
  return exceptions.lost + exceptions.returned + exceptions.exception;
}

/**
 * How much of the window a figure actually speaks for, as a sentence — or
 * null when it speaks for all of it and needs no caveat.
 *
 * This is the whole reason on-time delivery is allowed on the page. Amazon's
 * fulfilled-shipments report carries an estimated arrival date and no actual
 * one, so every FBA parcel sits outside that percentage however well Amazon
 * delivered it. A bare number would read as the business's delivery
 * performance when it can only describe the part of it that reports
 * deliveries.
 */
export function coverageNote(metric: ShippingMetric): string | null {
  if (metric.measured === null || metric.total === null) return null;
  if (metric.measured === 0) return "no shipments could report this";
  if (metric.measured >= metric.total) return null;
  return `${metric.measured} of ${metric.total} shipments`;
}

/** A carrier worth reading percentages off. Below this the row still shows —
 *  its shipment count is real — but the rates are greyed. */
export function hasReliableRates(carrier: CarrierRow): boolean {
  return !carrier.thin && carrier.on_time_pct !== null;
}

/** Carriers whose on-time rate is both meaningful and poor. */
export function underperforming(carriers: CarrierRow[], floor = 85): CarrierRow[] {
  return carriers.filter(
    (carrier) => hasReliableRates(carrier) && (carrier.on_time_pct ?? 100) < floor,
  );
}
