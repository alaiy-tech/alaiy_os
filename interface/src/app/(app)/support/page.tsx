import { requireOnboardedSession } from "@/lib/auth/dal";
import { buildMockCases } from "@/lib/support/mock-data";
import { SupportWorkspace } from "./support-workspace";

export const metadata = { title: "Support — Alaiy" };

/**
 * The Support tab: every open Amazon Seller Support case in one place.
 *
 * Amazon's SP-API has no endpoint to list a seller's cases, read a case
 * thread, or post a reply — see the issue's API constraint note. There is
 * therefore no backend module behind this tab the way there is for Orders or
 * Inventory: `buildMockCases` stands in for it, and `SupportWorkspace` holds
 * the list in client state rather than the URL, because a case Jordan adds
 * has nowhere server-side to be added to yet.
 *
 * Still gated the same as every other tab, though — a seller who is not
 * onboarded should not land here any more than on Orders.
 */
export default async function SupportPage() {
  await requireOnboardedSession();

  return <SupportWorkspace initialCases={buildMockCases()} />;
}
