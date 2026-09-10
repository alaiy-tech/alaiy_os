import type { ChannelId } from "@/lib/backend/types";

/**
 * Inventory per listing: what you have, where, and when it runs out.
 *
 * Distinct from `lib/backend/types.ts`'s `ChannelProduct`, which is the raw
 * per-channel shape the existing Inventory table reads. That one is a fact each
 * channel reports; this one gathers every stock pool visible for the same SKU —
 * warehouse, Shopify, FBA — and adds the days-of-cover arithmetic no source
 * does for you. Both grains live on the Inventory tab, and the toggle between
 * them is in the URL.
 *
 * One row per (channel, SKU), like the Listings tab. These rows used to merge a
 * product's channels together under a product group; that grouping is gone, so
 * a SKU sold on both channels is two rows rather than one row whose totals
 * depended on the two having been paired correctly.
 */

/** Where a stock figure came from. The spec wants this visible per row. */
export type StockSource = "wms" | "erp" | "shopify" | "amazon";

/** The spec's bands, by days of cover. */
export type CoverBand = "healthy" | "watch" | "low" | "critical" | "unknown";

export type StockRow = {
  /** The channel product's own id — this row's identity, not a group's. */
  row_id: string;
  channel: ChannelId;
  name: string;
  /** The SKU, and the bridge to ERPNext: warehouse stock and PO lines match
   *  on `item_code == brand_sku`. */
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
