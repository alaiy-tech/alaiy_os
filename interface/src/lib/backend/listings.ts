import "server-only";
import { backend } from "@/lib/backend/client";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import type {
  ListingDetail,
  ListingHealth,
  ListingsPage,
} from "@/lib/listings/types";
import type { ChannelId } from "@/lib/backend/types";

/**
 * The Listings tab's reads.
 *
 * Reads only. This module used to carry the link/unlink/exclusive writes that
 * joined two channels' listings into one product; that grouping is gone, and
 * with it the only writes the tab ever had. Editing a listing happens on the
 * channel, and every row links out to it.
 *
 * Neither call takes a workspace. The backend derives it from the session and
 * offers no parameter to name another seller's.
 */

const BASE = "/api/method/alaiy_os_self_serve_apis.api.listings";

const OVERVIEW = `${BASE}.overview`;
const LISTING = `${BASE}.listing`;

/** Matches api/listings.py's PAGE_SIZE. The backend caps anything larger. */
export const PAGE_SIZE = 50;

export type ListingsQuery = {
  health?: ListingHealth;
  channel?: ChannelId;
  category?: string;
  start?: number;
  limit?: number;
};

/**
 * An empty page, for the failure path.
 *
 * `sample: false` deliberately. The banner that says "these figures are made
 * up" renders off that flag, and a failed read is not sample data — showing
 * that banner over an outage would misdescribe both.
 */
const EMPTY: ListingsPage = {
  sample: false,
  listings: [],
  total: 0,
  start: 0,
  limit: PAGE_SIZE,
  categories: [],
  seller_central: null,
};

/**
 * Fills in the paging fields if the backend did not send them.
 *
 * For one deploy only: a backend without the paged endpoint answers the old
 * shape, and `total: undefined` reaches the pager as NaN rather than as an
 * error. These two apps deploy together, so this is insurance against the order
 * they are merged in, not a contract.
 */
function paged(page: ListingsPage): ListingsPage {
  return {
    ...page,
    listings: page.listings ?? [],
    total: page.total ?? 0,
    start: page.start ?? 0,
    limit: page.limit || PAGE_SIZE,
  };
}

export type ListingsResult = { page: ListingsPage; error?: string };

/**
 * One page of listings, worst health first.
 *
 * Filtering, ordering and paging all happen on the backend rather than here.
 * This tab used to read the whole catalogue in one go — defensible for a
 * comparison table, and fine until a seller had a real catalogue, at which
 * point the read cost a full product scan of the widest columns in the app.
 * The filter belongs with the data regardless, so the category list and the
 * filtered set cannot disagree.
 *
 * There is no second read any more. The unlinked queue had its own endpoint and
 * its own offset because it ran the suggestion matcher and was the expensive
 * half of this tab; with the grouping gone there is no matcher and no queue.
 *
 * Returns its failure rather than throwing, like every other reader here: a
 * listings outage should cost the seller this table, not the shell around it.
 */
export async function loadListings(
  query: ListingsQuery = {},
  userToken?: string,
): Promise<ListingsResult> {
  try {
    const page = await backend.get<ListingsPage | null>(OVERVIEW, {
      query: {
        health: query.health,
        channel: query.channel,
        category: query.category,
        start: query.start ?? 0,
        limit: query.limit ?? PAGE_SIZE,
      },
      userToken,
    });
    return { page: page ? paged(page) : EMPTY };
  } catch (error) {
    return { page: EMPTY, error: userFacingError(error, OUR_FAULT) };
  }
}

export type ListingResult =
  | { listing: ListingDetail; error?: undefined }
  | { listing?: undefined; error: string };

/**
 * One listing, in full, for the detail panel.
 *
 * A separate call rather than a find() over the page, because the URL is
 * shareable: `?listing=` can name a row the current filters exclude, or one on
 * another page, and a link that opened an empty panel because of a filter the
 * recipient inherited would be baffling.
 */
export async function loadListing(
  listingId: string,
  userToken?: string,
): Promise<ListingResult> {
  try {
    const listing = await backend.get<ListingDetail | null>(LISTING, {
      query: { listing_id: listingId },
      userToken,
    });
    if (!listing) return { error: "That listing could not be found." };
    return { listing };
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }
}
