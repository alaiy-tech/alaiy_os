"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/dal";
import { updateSession } from "@/lib/auth/session";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import { saveProfile } from "@/lib/backend/workspace";
import { startImport } from "@/lib/backend/imports";
import { amazonConnectUrl, connectShopify } from "@/lib/backend/connectors";
import { revalidatePath } from "next/cache";
import type { ChannelId } from "@/lib/backend/types";

export type FormState = { error?: string };


/** Step 1 — email path only. Google SSO already supplied name and photo. */
export async function saveProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const full_name = String(formData.get("full_name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();

  if (!full_name || !company || !role) {
    return { error: "Fill in all three fields." };
  }

  try {
    await saveProfile(
      session.workspaceId,
      { full_name, company, role },
      session.backendToken,
    );
    await updateSession({ name: full_name, onboardingStep: "connect" });
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  // Back to /start, which now resolves the step from the session it just
  // advanced and renders Connect in the same column. Revalidated first because
  // the destination is the page the seller is already on: the step has to be
  // read from the session written a line ago, not from a cached render of it.
  revalidatePath("/start");
  redirect("/start");
}

/**
 * The last step — queue the 90-day backfill and hand the seller the app.
 *
 * There is no progress screen to wait on any more: they go to Ask Alaiy and
 * watch the import from the status box that follows them around. The backend
 * marks onboarding complete as it queues the jobs, which is why this can send
 * them somewhere that requires a finished onboarding.
 */
export async function startImportAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const channels = formData.getAll("channels").map(String) as ChannelId[];

  if (channels.length === 0) {
    return { error: "Connect at least one channel before importing." };
  }

  try {
    await startImport(session.workspaceId, channels, session.backendToken);
    await updateSession({ onboardingStep: "done" });
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  redirect("/home");
}

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
 */
export async function connectShopifyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

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

  revalidatePath("/start");
  return {};
}

/**
 * Start Amazon authorisation.
 *
 * The connector builds the consent URL because the SP-API app credentials live
 * on the bench, and Seller Central redirects back to the connector too. This
 * app only sends the seller out.
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
