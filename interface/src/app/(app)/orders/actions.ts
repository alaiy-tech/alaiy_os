"use server";

import { refresh } from "next/cache";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { saveFlagRules } from "@/lib/backend/workspace";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import { RULE_BOUNDS, type RuleKey } from "@/lib/orders/rules";

/**
 * The one mutation the Orders tab has.
 *
 * The tab itself changes nothing about an order — it tracks, flags and
 * investigates, and every action still happens on the channel. What a seller
 * can change here is the definition of a problem, and only that.
 *
 * Re-verifies the session through the DAL rather than trusting the page that
 * rendered the form: a Server Action is reachable by a direct POST.
 */

export type FlagRulesState = { error?: string; notice?: string };

const KEYS: RuleKey[] = [
  "pending_payment_hours",
  "unshipped_hours",
  "fba_unshipped_hours",
];

export async function saveFlagRulesAction(
  _prev: FlagRulesState,
  formData: FormData,
): Promise<FlagRulesState> {
  const session = await requireOnboardedSession();

  const values: Partial<Record<RuleKey, number>> = {};
  for (const key of KEYS) {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) continue;
    const hours = Number.parseInt(raw, 10);
    // Bounded here as well as in the backend. An hour is too tight to be a
    // threshold and a month has stopped being one, and a seller who typed
    // something outside that deserves to be told rather than silently clamped.
    if (!Number.isFinite(hours) || hours < RULE_BOUNDS.min || hours > RULE_BOUNDS.max) {
      return {
        error: `Thresholds are in hours, between ${RULE_BOUNDS.min} and ${RULE_BOUNDS.max}.`,
      };
    }
    values[key] = hours;
  }

  if (!Object.keys(values).length) return { error: "Nothing to save." };

  try {
    await saveFlagRules(session.workspaceId, values, session.backendToken);
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  // The flags on every row were computed with the old thresholds, so the whole
  // table is now out of date — not just this form.
  refresh();
  return { notice: "Flag rules saved." };
}
