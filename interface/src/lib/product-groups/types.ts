import type { ChannelId, Paged } from "@/lib/backend/types";

/**
 * Product groups: one physical product, however many channels sell it.
 *
 * The shared vocabulary behind both the Listings tab (#16) and Inventory's
 * by-product view (#17). It lives here rather than in either tab because the
 * two issues describe the *same* idea from different angles — Listings asks
 * what each channel says about a product, Inventory asks how much of it there
 * is — and two copies of the shape would have drifted the first time one tab
 * learned something the other did not.
 *
 * `lib/backend/listings.ts` reads these from
 * `alaiy_os_self_serve_apis.api.listings`, and `lib/backend/inventory.ts`
 * reads the stock side from the same product groups.
 */

/**
 * One physical product, however many channels sell it.
 *
 * The central idea behind both the Listings and the Inventory tabs. The Canvas
 * Tote Bag is one thing to reorder and one thing to price; that it is
 * `CT-TOTE-BLK-001` on Shopify and `B09XKQL3M2` on Amazon is an accident of
 * where it is listed. Every other grain in this app is (product, channel) —
 * this is the one place the two are pulled back together, which is why the
 * link is a first-class fact with a method and a confidence on it.
 */
export type LinkMethod =
  /** Barcode/UPC matched on both sides. No human confirmation needed. */
  | "barcode"
  /** Titles and descriptions compared; a person still has to confirm. */
  | "ai_suggested"
  /** Someone picked it by hand. */
  | "manual"
  /** Genuinely sold on one channel only — an Amazon bundle, say. Not a gap. */
  | "exclusive";

/** Green / yellow / red, as the spec fixes them. */
export type ListingHealth = "live" | "warning" | "suppressed";

/** One channel's version of a product group. */
export type ChannelListing = {
  channel: ChannelId;
  /** The channel's own id: a Shopify product id, or an ASIN. */
  external_id: string;
  /** SKU on Shopify; on Amazon the seller SKU, which need not match. */
  sku?: string | null;
  title?: string | null;
  description?: string | null;
  /** Channel vocabulary, unmapped — see the note on ChannelProduct.status. */
  status?: string | null;
  active: boolean;
  price?: number | null;
  currency?: string | null;
  images: string[];
  /** Amazon only. Shopify has no equivalent field. */
  bullets?: string[] | null;
  category?: string | null;
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

export type ProductGroup = {
  id: string;
  name: string;
  /** The seller's own SKU for the physical thing, across channels. */
  brand_sku: string;
  category?: string | null;
  barcode?: string | null;
  /** Worst channel wins, so a red Amazon listing makes the group red. */
  health: ListingHealth;
  link_method: LinkMethod;
  /** 0–100 for an AI-suggested link; absent for the other methods. */
  link_confidence?: number | null;
  listings: ChannelListing[];
  last_synced_at?: string | null;
};

/**
 * A product on one channel that no group has claimed.
 *
 * `suggested_match` is present when there is a probable counterpart but not
 * enough confidence to link it unattended — the spec's threshold is 85%, so
 * anything above it is offered here for confirmation and anything below goes
 * to the manual queue with no suggestion at all.
 */
export type UnlinkedProduct = {
  channel: ChannelId;
  external_id: string;
  /** This row's own id, which is what the confirm and exclusive actions name. */
  product_id: string;
  sku?: string | null;
  title?: string | null;
  barcode?: string | null;
  image_url?: string | null;
  suggested_match?: {
    /**
     * The counterpart's group, when it already has one — usually null, because
     * the common case is two products neither of which is in a group yet.
     * `counterpart_id` is what the confirm action actually needs.
     */
    group_id: string | null;
    group_name?: string | null;
    confidence: number;
    /** What the suggestion was based on, so a person can judge it. */
    basis: "barcode" | "title" | "description";
    /** The product on the other channel this would be joined to. */
    counterpart_id: string;
  };
};

/**
 * One page of product groups.
 *
 * `groups` rather than the `rows` every other paged shape uses, because the
 * endpoint answers `groups` and a rename here would only move the mismatch.
 * The three paging fields are the same three as everywhere else.
 */
export type ListingsPage = {
  /**
   * True while these figures are fabricated. The banner that says so renders
   * off this, so it disappeared on its own the day the backend started
   * answering — which it now does, returning false. Kept rather than removed:
   * it is the mechanism that makes a future stubbed endpoint honest, and it
   * costs one boolean.
   */
  sample: boolean;
  groups: ProductGroup[];
  /** Groups matching the filters across every page, not just this one. */
  total: number;
  start: number;
  limit: number;
  /** Every category present, for the filter. */
  categories: string[];
};

/**
 * One page of the unlinked queue — its own read, its own offset.
 *
 * Separate from `ListingsPage` because it is the expensive half of the tab: it
 * is the read that computes a suggestion for every row, so paging it is what
 * keeps that cost proportional to what is on screen rather than to the whole
 * catalogue. Paging the groups table does not recompute any of it.
 */
export type UnlinkedPage = Paged<UnlinkedProduct>;

/**
 * One product group with everything the side-by-side view needs.
 *
 * A superset of `ProductGroup`: the detail read also answers *who* joined the
 * channels and when, which the table has no column for and which matters when
 * a join turns out to be wrong — a barcode match and a person's decision are
 * undone in different places.
 */
export type ProductGroupDetail = ProductGroup & {
  /** Set only where a person confirmed the join. A barcode match has nobody. */
  linked_by?: string | null;
  linked_at?: string | null;
  sample?: boolean;
};
