"use server";

import { refresh } from "next/cache";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import { linkProducts, markExclusive, unlinkGroup } from "@/lib/backend/listings";

/**
 * The three decisions a person can make on the Listings tab.
 *
 * Everything else here is read-only — edits happen on the channel. What a
 * seller decides *in Alaiy* is which listings are the same physical product,
 * and that is a judgement no sync can make for them.
 *
 * Each action re-verifies the session through the DAL rather than trusting the
 * page that rendered the form. A Server Action is reachable by a direct POST,
 * so the page having been rendered behind auth proves nothing about the
 * request that arrives.
 *
 * The ids are passed through untouched and re-read inside the workspace scope
 * on the backend. That is the boundary that matters: nothing here checks that
 * a product belongs to this seller, because the backend does it against the
 * session, and a check here would only be a second opinion from a less
 * trustworthy place.
 */

export type LinkState = { error?: string; done?: boolean };

/**
 * Confirm that two listings are the same product.
 *
 * The write with real consequences on this tab: from here the two share a
 * stock row and one days-of-cover figure. `confidence` records what the
 * matcher scored when a person is confirming its suggestion, so a link made by
 * agreeing with the machine stays distinguishable from one made by searching.
 */
export async function linkAction(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const session = await requireOnboardedSession();

  const productId = String(formData.get("product_id") ?? "").trim();
  const counterpartId = String(formData.get("counterpart_id") ?? "").trim();
  if (!productId || !counterpartId) {
    return { error: "Nothing to link." };
  }

  // Absent for a link made by hand, which is a real difference rather than a
  // zero — the backend stores the two under different methods.
  const raw = formData.get("confidence");
  const confidence = raw === null || raw === "" ? undefined : Number(raw);
  if (confidence !== undefined && !Number.isFinite(confidence)) {
    return { error: "That confidence score isn't a number." };
  }

  try {
    await linkProducts(productId, counterpartId, confidence, session.backendToken);
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  // Both the unlinked list and the group table change, and they are on the
  // same screen, so the whole route is re-read rather than one panel.
  refresh();
  return { done: true };
}

/**
 * Record that a product is sold on one channel on purpose.
 *
 * Not the same as leaving it unlinked, and the difference is the point: an
 * unlinked product is a job someone still has to do, an exclusive one is
 * finished. Without this an Amazon-only bundle sits in the queue for ever, and
 * a queue that never empties stops being read.
 */
export async function markExclusiveAction(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const session = await requireOnboardedSession();

  const productId = String(formData.get("product_id") ?? "").trim();
  if (!productId) return { error: "Nothing to mark." };

  try {
    await markExclusive(productId, session.backendToken);
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  refresh();
  return { done: true };
}

/**
 * Undo a link.
 *
 * Honest about what it does not do: a group the barcodes matched comes back on
 * the next sync, because the barcodes still say it is one product. The button
 * that calls this says so, rather than promising something the next sync
 * quietly reverses.
 */
export async function unlinkAction(
  _prev: LinkState,
  formData: FormData,
): Promise<LinkState> {
  const session = await requireOnboardedSession();

  const groupId = String(formData.get("group_id") ?? "").trim();
  if (!groupId) return { error: "Nothing to unlink." };

  try {
    await unlinkGroup(groupId, session.backendToken);
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  refresh();
  return { done: true };
}
