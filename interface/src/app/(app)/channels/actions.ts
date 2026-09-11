"use server";

import { refresh } from "next/cache";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { disconnectChannel, setPermission } from "@/lib/backend/connectors";
import { resyncChannel, type SyncKind } from "@/lib/backend/imports";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import { channelName, isChannel, isLiveChannel } from "@/lib/channels";
import type { ChannelId, PermissionDecision } from "@/lib/backend/types";

/**
 * The mutations the Channels tab offers: sync, disconnect, and changing what
 * Alaiy is allowed to do with one of the channel's permissions.
 *
 * Every one re-verifies the session through the DAL rather than trusting the
 * page that rendered the form: a Server Action is reachable by a direct POST,
 * so the check has to live here. Each also validates its arguments against a
 * fixed set — the channel, the sync kind and the permission setting arrive as
 * form fields, which means they arrive as whatever the caller typed.
 *
 * They treat a switched-off channel differently, and deliberately.
 * Disconnecting one has to keep working, or a store attached while its channel
 * was live could never be detached; starting a fresh sync on one must not.
 * Narrowing its permissions has to keep working for the same reason
 * disconnecting does — a seller winding a channel down is exactly who wants
 * to.
 */

export type ChannelActionState = {
  error?: string;
  notice?: string;
  /**
   * How many times the permission action has settled on this state hook.
   *
   * Exists so the permission dropdown has something that changes on *every*
   * settled submission, success or failure. Keying it on the error text alone
   * was not enough: two consecutive failures return the same message — the
   * `OUR_FAULT` fallback is a constant — so the key held still and React
   * reused the node, leaving the seller's second, unsaved choice on screen.
   * A Server Action has no memory of its own, so the count is carried through
   * the previous state rather than kept anywhere.
   */
  attempt?: number;
};

const KINDS: SyncKind[] = ["products", "orders"];

/** Any channel this app knows, live or not. */
function readChannel(formData: FormData): ChannelId | undefined {
  const raw = String(formData.get("channel") ?? "");
  return isChannel(raw) ? raw : undefined;
}

/**
 * Queue a fresh pull of one kind for one channel.
 *
 * Returns as soon as the backend has queued it. The seller is told that, not
 * that the data has arrived — the work happens on a worker, and the row's
 * "last synced" is what will eventually say it landed.
 */
export async function syncChannelAction(
  _prev: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  const session = await requireOnboardedSession();

  const channel = readChannel(formData);
  const rawKind = String(formData.get("kind") ?? "");
  const kind = KINDS.find((k) => k === rawKind);
  if (!channel || !kind) return { error: "Unknown channel or sync type." };
  if (!isLiveChannel(channel)) {
    return { error: `${channelName(channel)} syncing is switched off.` };
  }

  try {
    await resyncChannel(session.workspaceId, channel, kind, session.backendToken);
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  refresh();
  return { notice: `${channelName(channel)} ${kind} sync queued.` };
}

/**
 * Drop a channel's stored credentials.
 *
 * The backend keeps everything already synced — this stops future syncing, it
 * does not erase history. The button says so, because "disconnect" reads like
 * it might take the data with it.
 */
export async function disconnectChannelAction(
  _prev: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  const session = await requireOnboardedSession();

  const channel = readChannel(formData);
  if (!channel) return { error: "Unknown channel." };

  try {
    await disconnectChannel(session.workspaceId, channel, session.backendToken);
  } catch (error) {
    return { error: userFacingError(error, OUR_FAULT) };
  }

  refresh();
  return { notice: `${channelName(channel)} disconnected.` };
}

/** The three settings a permission can be on. Posted, so validated here. */
const DECISIONS: PermissionDecision[] = ["allowed", "needs_approval", "blocked"];

/**
 * Change what Alaiy may do with one of a channel's permissions.
 *
 * The backend owns the catalogue, so an unknown permission id is rejected
 * there rather than mirrored into a list here that would drift the first time
 * a role is added. What this checks is the decision, which is a closed set the
 * dropdown already knows.
 *
 * No notice on success. The dropdown showing the new value is the confirmation
 * — a line of prose under it saying the same thing is one more thing to read
 * on a screen whose whole job is to be scanned.
 *
 * Every return carries an incremented `attempt`, including the failures. That
 * is what the dropdown keys on, so see the field's own note for why the error
 * text could not do the job.
 */
export async function setPermissionAction(
  prev: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  const attempt = (prev.attempt ?? 0) + 1;
  const session = await requireOnboardedSession();

  const channel = readChannel(formData);
  const permission = String(formData.get("permission") ?? "");
  const rawDecision = String(formData.get("decision") ?? "");
  const decision = DECISIONS.find((value) => value === rawDecision);
  if (!channel || !permission || !decision) {
    return { attempt, error: "Unknown channel or permission setting." };
  }

  try {
    await setPermission(
      session.workspaceId,
      channel,
      permission,
      decision,
      session.backendToken,
    );
  } catch (error) {
    return { attempt, error: userFacingError(error, OUR_FAULT) };
  }

  refresh();
  return { attempt };
}
