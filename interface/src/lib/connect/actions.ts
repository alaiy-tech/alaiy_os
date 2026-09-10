"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireSession } from "@/lib/auth/dal";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import { amazonConnectUrl, shopifyConnectUrl } from "@/lib/backend/connectors";

/**
 * Attaching a channel, from wherever the seller is standing.
 *
 * These lived in `app/start/onboarding-actions.ts`, next to the only screen
 * that could reach them. That made the Connect button on the Channels tab a
 * link to /start — which redirects anyone who has finished onboarding, so it
 * landed them on Home instead of a form. Connecting a second channel later is
 * not an onboarding step, so the actions do not belong to onboarding.
 *
 * `refresh()` rather than `revalidatePath("/start")` for the same reason: the
 * action no longer knows which page called it, and refresh re-renders the one
 * that did.
 */

export type FormState = { error?: string };

/**
 * Start Shopify OAuth.
 *
 * The seller enters their store domain and is redirected to Shopify's install
 * screen. Shopify sends them back to the connector's callback, which exchanges
 * the code for a permanent access token and redirects here with ?connected=shopify.
 */
export async function startShopifyOAuthAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const shop = String(formData.get("shop") ?? "").trim();
  if (!shop) return { error: "Enter your Shopify store domain." };

  let url: string;
  try {
    ({ url } = await shopifyConnectUrl(session.workspaceId, shop, session.backendToken));
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  redirect(url);
}

/**
 * Start Amazon authorisation.
 *
 * The connector builds the consent URL because the SP-API app credentials live
 * on the bench, and Seller Central redirects back to the connector too. This
 * app only sends the seller out.
 *
 * Note where that redirect lands: /onboarding/connect, which forwards to
 * /start. A seller connecting Amazon from the Channels tab therefore comes
 * back to onboarding's screen, which sends them on to Home because they are
 * already onboarded. They arrive connected either way — but the round trip is
 * why the Amazon row cannot claim to keep them on Channels.
 */
export async function connectAmazonAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const region = String(formData.get("region") ?? "NA") as "NA" | "EU" | "FE";

  let url: string;
  try {
    ({ url } = await amazonConnectUrl(session.workspaceId, region, session.backendToken));
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  redirect(url);
}
