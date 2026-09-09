"use server";

import { refresh } from "next/cache";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { dismissHomeAlert } from "@/lib/backend/home";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";

/**
 * The one mutation the Home dashboard has.
 *
 * Home changes nothing about the business — it reports and it points at the
 * tab where something can be done. What a seller can change here is whether
 * they have seen an alert, and only that.
 *
 * Re-verifies the session through the DAL rather than trusting the page that
 * rendered the form: a Server Action is reachable by a direct POST.
 */

export type DismissAlertState = { error?: string };

export async function dismissAlertAction(
  _prev: DismissAlertState,
  formData: FormData,
): Promise<DismissAlertState> {
  const session = await requireOnboardedSession();

  const key = String(formData.get("key") ?? "").trim();
  // Not validated against a list of detector names. The backend owns which
  // alerts exist, it is deployed separately, and a dismissal of one this build
  // has never heard of is inert rather than dangerous — whereas a stale list
  // here would refuse to dismiss a brand-new alert.
  if (!key) return { error: "Nothing to dismiss." };

  // The empty string is a real fingerprint, not a missing one: an alert whose
  // state does not vary has nothing to put in it.
  const fingerprint = String(formData.get("fingerprint") ?? "");

  try {
    await dismissHomeAlert(key, fingerprint, session.backendToken);
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  // The bar has already hidden the row optimistically. This is what makes the
  // dismissal survive a reload, and what re-reads the tiles in case the same
  // visit is also where the seller notices something changed.
  refresh();
  return {};
}
