import type { ChannelId } from "@/lib/backend/types";

/**
 * The Shipping tab's own shapes.
 *
 * Unlike Support and Ratings, nothing here is blocked by a missing API —
 * the issue's data sources (SP-API's Orders API, Shopify's fulfilment
 * events, carrier tracking APIs, the WMS) are all real, buildable
 * integrations. There is still no backend module behind this tab, only
 * because none of those are wired up yet — `mock-data.ts` stands in for the
 * whole pipeline, not for a single blocked endpoint.
 */

export type CarrierRow = {
  id: string;
  name: string;
  /** Amazon's own fulfilment network. No seller-controlled handling time —
   *  see the issue's key decision — but still a row here, since on-time rate
   *  and transit days are still worth watching per carrier. */
  isFBA: boolean;
  shipments: number;
  onTimePct: number;
  avgTransitDays: number;
  exceptions: { stuck: number; lost: number; returned: number };
};

export type HandlingTimePoint = { date: string; avgHours: number };

/** A business event worth marking on the handling-time trend — a 3PL
 *  switch, not a metric of its own. */
export type ChartAnnotation = { date: string; label: string };

export type ShippingMetric = { value: number; previous: number };

export type ShippingSummary = {
  /** Order placed to dispatch confirmed — Jordan's controllable number. Only
   *  seller-fulfilled orders count; see the issue's key decision on FBA. */
  avgHandlingHours: ShippingMetric;
  onTimeDispatchPct: ShippingMetric;
  /** Dispatch to delivery — the carrier's number, not Jordan's. */
  onTimeDeliveryPct: ShippingMetric;
  lateShipmentRatePct: ShippingMetric;
};

export type LateShipmentStatus = "shipped_late" | "at_risk";

export type LateShipment = {
  id: string;
  channel: ChannelId;
  orderNumber: string;
  externalOrderId: string;
  carrier: string;
  expectedShipDate: string;
  status: LateShipmentStatus;
  /** Days past the expected ship date the dispatch happened — 0 for
   *  "at risk", where nothing has dispatched yet to measure. */
  daysLate: number;
};
