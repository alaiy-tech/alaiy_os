import "server-only";
import { cache } from "react";
import { backend } from "@/lib/backend/client";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import type { RatingsPage } from "@/lib/ratings/types";

/**
 * The Ratings tab's reads.
 *
 * One endpoint, because the four panels are one screen and three of them are
 * computed from rows the others already read — the concerns banner is the
 * negative slice of the topic list, and the improvements panel is the rating
 * table's own deltas. Fetching them separately would read the same tables twice
 * and let the banner disagree with the table beneath it.
 *
 * Amazon only, and the backend says so in the payload rather than this module
 * hardcoding it: Shopify's API has no reviews of its own, and the day a review
 * app is integrated the tab should stop saying that without a frontend change.
 */

const API = "/api/method/alaiy_os_self_serve_apis.api.ratings";

/**
 * An empty page, for the failure path.
 *
 * `connected` is false, which is the honest reading of a call that did not
 * answer — we do not know this seller has no Amazon account, only that we could
 * not ask. The tab renders its shell and the error rather than an empty table
 * that reads as a seller with no feedback.
 */
const EMPTY: RatingsPage = {
  connected: false,
  channels: [],
  gaps: [],
  seller_rating: null,
  feedback: [],
  topics: [],
  concerns: [],
  products: [],
  improvements: [],
  seller_central: null,
  synced_at: null,
  never_synced: true,
};

export type RatingsResult = { page: RatingsPage; error?: string };

/**
 * Seller rating, buyer feedback, review topics and rating trends.
 *
 * Returns its failure alongside an empty page rather than throwing, like every
 * other reader here: losing the aggregates should cost the seller those panels,
 * not the shell around them.
 */
export const loadRatings = cache(
  async (userToken?: string): Promise<RatingsResult> => {
    try {
      const page = await backend.get<RatingsPage | null>(`${API}.overview`, { userToken });
      if (!page) return { page: EMPTY, error: OUR_FAULT };
      return {
        page: {
          ...page,
          channels: page.channels ?? [],
          gaps: page.gaps ?? [],
          feedback: page.feedback ?? [],
          topics: page.topics ?? [],
          concerns: page.concerns ?? [],
          products: page.products ?? [],
          improvements: page.improvements ?? [],
        },
      };
    } catch (error) {
      return { page: EMPTY, error: userFacingError(error, OUR_FAULT) };
    }
  },
);

/**
 * Queue a fresh pull of the review aggregates.
 *
 * Returns as soon as it is queued, and the seller is told that rather than that
 * new numbers have arrived — this is a call per product on Amazon's side, and
 * Amazon rebuilds the aggregates about weekly anyway, so a refresh usually
 * confirms rather than changes.
 */
export async function refreshRatings(
  userToken?: string,
): Promise<{ queued: boolean; job: string }> {
  return backend.post(`${API}.refresh`, {}, { userToken });
}
