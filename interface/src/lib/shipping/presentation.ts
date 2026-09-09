import type { LateShipment } from "./types";

/**
 * How a shipping metric reads: which direction is actually an improvement,
 * and the fixed thresholds the tab measures against.
 *
 * Client-safe, like the equivalent files for Support and Ratings — the tone
 * on a trend arrow has to be readable wherever the figure is shown.
 */

/** Amazon suspends Buy Box / triggers Account Health review at 4%. */
export const LATE_SHIPMENT_RATE_THRESHOLD = 4.0;

export type Trend = {
  label: string;
  direction: "up" | "down" | "flat";
  /** "up" is not always good — a lower Late Shipment Rate is the win. */
  tone: "ok" | "alert" | "neutral";
};

/**
 * A metric's 7-day trend arrow.
 *
 * Whether "up" is good depends on the metric — handling time and Late
 * Shipment Rate want to fall, the two on-time rates want to rise — so the
 * tone is computed from `higherIsBetter` rather than always reading a rise
 * as progress. Direction and tone are kept separate for the same reason
 * `lib/format.ts` keeps `direction` and the sign apart: the arrow says which
 * way the number moved, the colour says whether that is welcome.
 */
export function trendFor(
  value: number,
  previous: number,
  opts: { higherIsBetter: boolean; unit: "h" | "pp"; digits?: number },
): Trend {
  const { higherIsBetter, unit, digits = 1 } = opts;
  const change = value - previous;
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
export function exceptionCount(exceptions: { stuck: number; lost: number; returned: number }): number {
  return exceptions.stuck + exceptions.lost + exceptions.returned;
}

/** Not yet dispatched at all — the ones a warehouse can still act on today,
 *  as opposed to one already dispatched late and now just in transit. */
export function undispatched(shipments: LateShipment[]): LateShipment[] {
  return shipments.filter((shipment) => shipment.status === "at_risk");
}
