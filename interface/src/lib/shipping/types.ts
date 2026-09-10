import type { ChannelId } from "@/lib/backend/types";

/**
 * The Shipping tab's shapes, as `api/shipping.py` returns them.
 *
 * Snake case, like every other backend-shaped type here — these cross the wire
 * as-is rather than through a renaming layer that has to be kept in step with
 * the Python.
 *
 * Three sources fill these rows and they do not fill in the same columns:
 * Amazon's merchant-fulfilled packages (Orders API), Amazon's own shipments
 * (the fulfilled-shipments report, which carries no actual delivery date), and
 * Shopify's fulfilments. That is why almost every figure here arrives with the
 * count it was computed over — see `ShippingMetric.measured`.
 */

/**
 * A number, the same number for the window before it, and how much of the
 * window could actually answer.
 *
 * `value` is null when nothing could — which is not zero. A seller with no
 * dispatches this week has no average handling time, and rendering 0h would
 * read as instant fulfilment.
 *
 * `measured` against `total` is the honesty of the tile: on-time delivery can
 * only be computed for parcels that report a delivery date, and Amazon's own
 * shipments never do.
 */
export type ShippingMetric = {
  value: number | null;
  previous: number | null;
  /** Parcels this figure was computed over. Null where the concept does not
   *  apply — Late Shipment Rate is Amazon's own number, not an average of
   *  anything we hold. */
  measured: number | null;
  total: number | null;
};

export type LateShipmentRateMetric = ShippingMetric & {
  /** The date of the reading. Amazon rebuilds it about daily. */
  as_of: string | null;
  /** Always Amazon's own. This tab reads the stored Account Health value
   *  rather than deriving a second figure from parcels — a tab that computed
   *  its own would eventually disagree with Seller Central about the number
   *  the account is actually judged on. */
  source: "amazon_account_health";
};

export type ShippingSummary = {
  /** Order placed to dispatch confirmed. Seller-fulfilled only: Amazon picks,
   *  packs and ships its own, so there is no handling time of the seller's to
   *  measure and averaging Amazon's speed in would credit or blame them for
   *  something they did not do. */
  avg_handling_hours: ShippingMetric;
  /** Dispatched by the date promised. Amazon only — Shopify makes no dispatch
   *  promise this app can read, so its parcels are outside the denominator
   *  rather than counted as on time. */
  on_time_dispatch_pct: ShippingMetric;
  /** Delivered by the estimated date, over the parcels that report a delivery
   *  at all. */
  on_time_delivery_pct: ShippingMetric;
  late_shipment_rate_pct: LateShipmentRateMetric;
  /** Amazon's own limit, above which Buy Box eligibility is at risk. */
  threshold: number;
  packages: number;
};

export type HandlingTimePoint = {
  date: string;
  avg_hours: number;
  shipments: number;
};

/** Amazon's own classification, mirrored rather than reinterpreted. There is
 *  deliberately no "stuck" bucket — that would be our inference about a parcel
 *  still moving, sitting in a column of things carriers reported. */
export type CarrierExceptions = {
  lost: number;
  returned: number;
  exception: number;
};

export type CarrierRow = {
  carrier: string;
  channel: ChannelId;
  /** Every parcel on this carrier was Amazon-fulfilled. No seller-controlled
   *  handling time, but on-time rate and transit days are still worth seeing. */
  fba: boolean;
  shipments: number;
  /** Null when no parcel on this carrier reports both an actual and an
   *  estimated delivery — no on-time rate, which is different from a bad one. */
  on_time_pct: number | null;
  deliveries_measured: number;
  avg_transit_days: number | null;
  exceptions: CarrierExceptions;
  /** Too few parcels for the percentages to describe the carrier rather than
   *  the sample. The row stays — the shipment count is still worth seeing. */
  thin: boolean;
};

/** Promised but not yet dispatched — the ones a warehouse can still save
 *  today. Carries no carrier or days-late, because nothing has shipped. */
export type AtRiskShipment = {
  external_order_id: string;
  order_number: string | null;
  channel: ChannelId;
  promised_ship_by: string | null;
  order_date: string | null;
  carrier: null;
  days_late: null;
};

/** Already went out after the date promised. A record, not an action. */
export type ShippedLateShipment = {
  external_order_id: string;
  order_number: string | null;
  channel: ChannelId;
  carrier: string | null;
  promised_ship_by: string | null;
  ship_date: string | null;
  days_late: number;
};

export type LateShipments = {
  at_risk: AtRiskShipment[];
  shipped_late: ShippedLateShipment[];
  /**
   * Amazon, merchant-fulfilled. FBA is excluded because Amazon ships those
   * itself and they cannot count against the seller; Shopify because it makes
   * no dispatch promise to be late against, and inventing one from a threshold
   * of ours would put orders on a "late" list nobody agreed were late.
   */
  scope: "amazon_merchant_fulfilled";
};

/**
 * What the numbers are made of, decided on the backend.
 *
 * An empty carrier table means "no channel connected", "nothing shipped this
 * month" or "the Amazon Fulfilment role was never granted" — three different
 * sentences, none derivable from an absence of rows in the browser.
 */
export type ShippingCoverage = {
  amazon_connected: boolean;
  shopify_connected: boolean;
  packages: number;
  seller_fulfilled: number;
  amazon_fulfilled: number;
  shopify_packages: number;
  /** Whether the fulfilled-shipments report has ever answered. Its absence on
   *  a seller with FBA sales is a role gap, not a quiet month. */
  has_fba_shipments: boolean;
  has_deliveries: boolean;
  synced_at: string | null;
};

export type ShippingPage = {
  days: number;
  summary: ShippingSummary;
  handling_time_trend: HandlingTimePoint[];
  carriers: CarrierRow[];
  late_shipments: LateShipments;
  coverage: ShippingCoverage;
};
