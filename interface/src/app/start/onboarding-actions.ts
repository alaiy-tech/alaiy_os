"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/dal";
import { updateSession } from "@/lib/auth/session";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import { saveProfile } from "@/lib/backend/workspace";
import { startImport } from "@/lib/backend/imports";
import { revalidatePath } from "next/cache";
import { isLiveChannel } from "@/lib/channels";

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
  // Filtered rather than cast: these arrive as form fields, so they are
  // whatever the caller posted, and a switched-off channel must not be
  // backfilled just because a stale form still named it.
  const channels = formData.getAll("channels").map(String).filter(isLiveChannel);

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
