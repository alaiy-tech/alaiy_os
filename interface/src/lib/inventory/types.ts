/**
 * Inventory at product-group grain: what you have, where, and when it runs out.
 *
 * Distinct from `lib/backend/types.ts`'s `ChannelProduct`, which is the real,
 * per-channel shape the existing Inventory table reads. That one is a fact
 * each channel reports; this one merges the channels into the physical product
 * and adds the days-of-cover arithmetic no source does for you. Both grains
 * live on the Inventory tab, and the toggle between them is in the URL.
 */

/** Where a stock figure came from. The spec wants this visible per row. */
export type StockSource = "wms" | "erp" | "shopify" | "amazon";

/** The spec's bands, by days of cover. */
export type CoverBand = "healthy" | "watch" | "low" | "critical" | "unknown";

export type StockRow = {
  group_id: string;
  name: string;
  brand_sku: string;
  /** Null when this workspace has no warehouse source configured. */
  warehouse_qty: number | null;
  shopify_qty: number | null;
  amazon_fba_qty: number | null;
  total_available: number;
  /** Units per day, averaged over `velocity_days`. */
  sell_through: number | null;
  velocity_days: number;
  /** Null when nothing has sold — there is no cover to compute, not zero. */
  days_of_cover: number | null;
  band: CoverBand;
  incoming_units: number;
  /** The earliest open PO that would restock this. */
  next_arrival?: string | null;
  /** Which source the warehouse figure is the master from. */
  source: StockSource;
  /**
   * Set when Shopify's available disagrees with the warehouse by more than the
   * workspace's threshold — the oversell risk the spec asks to surface.
   */
  discrepancy?: { units: number; pct: number } | null;
  /** V1 placeholder. Lot-level cost lands with Profitability; never an average. */
  cogs: null;
};

export type PurchaseOrder = {
  po_number: string;
  supplier: string;
  skus: string[];
  units: number;
  expected_arrival?: string | null;
  status: "open" | "in_transit" | "received";
  /** Lowest days-of-cover among the SKUs on this PO, which is how they sort. */
  lowest_cover: number | null;
};

export type StockPage = {
  /** See ListingsPage.sample. */
  sample: boolean;
  rows: StockRow[];
  purchase_orders: PurchaseOrder[];
  /** Whether a WMS is configured, which decides what the source column means. */
  has_wms: boolean;
  /** The workspace's own cover thresholds, so the legend matches the colours. */
  thresholds: { critical: number; low: number; watch: number };
  /** The window the sell-through rate was averaged over, as answered. */
  velocity_days?: number;
};
