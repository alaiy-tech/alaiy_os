"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireSession } from "@/lib/auth/dal";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import { amazonConnectUrl, connectShopify } from "@/lib/backend/connectors";
import { isLiveChannel } from "@/lib/channels";

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
 * Attach a Shopify store.
 *
 * The custom app's Client ID and Secret are posted straight through to the
 * connector, which proves them against the shop before storing them
 * encrypted. Neither touches a cookie and neither is ever read back.
 *
 * A Server Action rather than a fetch from the browser, and that is the point
 * for these two: the secret goes browser -> our server -> the connector, so it
 * never crosses an origin and never sits in client-side JavaScript.
 *
 * The live check is here rather than only on the screens that render the form:
 * a Server Action is reachable by a direct POST, so hiding the form is not the
 * same as switching the channel off.
 */
export async function connectShopifyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  if (!isLiveChannel("shopify")) {
    return { error: "Shopify connections are switched off." };
  }

  const shop = String(formData.get("shop") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const clientSecret = String(formData.get("client_secret") ?? "").trim();

  if (!shop) return { error: "Enter your Shopify store domain." };
  if (!clientId) return { error: "Enter the custom app's Client ID." };
  if (!clientSecret) return { error: "Enter the custom app's Client Secret." };

  try {
    await connectShopify(
      session.workspaceId,
      shop,
      clientId,
      clientSecret,
      session.backendToken,
    );
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  refresh();
  return {};
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
