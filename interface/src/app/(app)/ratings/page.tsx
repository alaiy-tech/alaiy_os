import { requireOnboardedSession } from "@/lib/auth/dal";
import { PRODUCT_LIST, buildMockRatingsData } from "@/lib/ratings/mock-data";
import { RatingsWorkspace } from "./ratings-workspace";

export const metadata = { title: "Ratings — Alaiy" };

/**
 * The Ratings tab: review patterns, seller rating trend, and the business
 * events behind a change.
 *
 * Amazon's Feedback API is real and buildable, but its SP-API has no
 * endpoint for product review *text* — see the issue's open question, still
 * unresolved at the top of that issue. There is therefore no backend module
 * behind this tab yet: `buildMockRatingsData` previews the intended
 * experience, and `RatingsWorkspace` holds ops notes in client state, the
 * same reasoning as Support's case list.
 */
export default async function RatingsPage() {
  await requireOnboardedSession();

  const { reviews, sellerRating, positiveAttributions, opsNotes } = buildMockRatingsData();

  return (
    <RatingsWorkspace
      reviews={reviews}
      sellerRating={sellerRating}
      positiveAttributions={positiveAttributions}
      initialOpsNotes={opsNotes}
      products={PRODUCT_LIST}
    />
  );
}
