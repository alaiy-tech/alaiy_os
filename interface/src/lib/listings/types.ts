import type { ChannelId, SellerCentralSection } from "@/lib/backend/types";

/**
 * A listing: one channel's offer of one SKU.
 *
 * The grain of the Listings tab, and the grain the channel itself owns. There
 * was once a "product group" above this — one physical product, however many
 * channels sold it — that pulled a seller's Shopify and Amazon rows back
 * together so the tab could show them side by side. It is gone. Deciding that
 * two listings are the same thing is a guess, and every reading built on top of
 * it inherited the guess; a listing is a fact, and the channel is where it gets
 * fixed.
 *
 * `lib/backend/listings.ts` reads these from
 * `alaiy_os_self_serve_apis.api.listings`.
 */

/** Green / yellow / red, as the spec fixes them. */
export type ListingHealth = "live" | "warning" | "suppressed";

export type Listing = {
  /** Our own row id, and what `?listing=` names. */
  id: string;
  channel: ChannelId;
  /** The channel's own id: a Shopify product id, or an ASIN. */
  external_id: string;
  /** SKU on Shopify; on Amazon the seller SKU, which need not match. */
  sku?: string | null;
  title?: string | null;
  description?: string | null;
  /** Channel vocabulary, unmapped — a Shopify DRAFT and an Amazon suppression
   *  are not the same problem and do not have the same fix. */
  status?: string | null;
  active: boolean;
  price?: number | null;
  currency?: string | null;
  images: string[];
  /** Amazon only. Shopify has no equivalent field. */
  bullets?: string[] | null;
  image_url?: string | null;
  category?: string | null;
  barcode?: string | null;
  /** 0–100, the channel's listing completeness as we score it. */
  health_score?: number | null;
  health: ListingHealth;
  /**
   * Why Amazon suppressed this, already translated. Amazon's own reason codes
   * are cryptic, so the raw code rides along in `suppression_code` for support
   * and this is what the seller reads.
   */
  suppression_reason?: string | null;
  suppression_code?: string | null;
  suppressed_since?: string | null;
  /** The live listing, and the seller's own admin for it. */
  storefront_url?: string | null;
  admin_url?: string | null;
  last_synced_at?: string | null;
};

/**
 * One page of listings.
 *
 * `listings` rather than the `rows` every other paged shape uses, because the
 * endpoint answers `listings` and a rename here would only move the mismatch.
 * The three paging fields are the same three as everywhere else.
 */
export type ListingsPage = SellerCentralSection & {
  /**
   * True while these figures are fabricated. The banner that says so renders
   * off this, so it disappeared on its own the day the backend started
   * answering — which it now does, returning false. Kept rather than removed:
   * it is the mechanism that makes a future stubbed endpoint honest, and it
   * costs one boolean.
   */
  sample: boolean;
  listings: Listing[];
  /** Listings matching the filters across every page, not just this one. */
  total: number;
  start: number;
  limit: number;
  /** Every category present, for the filter. */
  categories: string[];
};

/** The detail read returns the same listing; the flag rides along with it. */
export type ListingDetail = Listing & { sample?: boolean };
