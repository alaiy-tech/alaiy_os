"use server";

import { refresh } from "next/cache";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { disconnectChannel } from "@/lib/backend/connectors";
import { resyncChannel, type SyncKind } from "@/lib/backend/imports";
import { OUR_FAULT, userFacingError } from "@/lib/backend/errors";
import { channelName } from "@/lib/channels";
import type { ChannelId } from "@/lib/backend/types";

/**
 * The two mutations the Channels tab offers.
 *
 * Both re-verify the session through the DAL rather than trusting the page
 * that rendered the form: a Server Action is reachable by a direct POST, so
 * the check has to live here. Both also validate their arguments against a
 * fixed set — the channel and the sync kind arrive as form fields, which means
 * they arrive as whatever the caller typed.
 */

export type ChannelActionState = { error?: string; notice?: string };

const CHANNELS: ChannelId[] = ["shopify", "amazon"];
const KINDS: SyncKind[] = ["products", "orders"];

function readChannel(formData: FormData): ChannelId | undefined {
  const raw = String(formData.get("channel") ?? "");
  return CHANNELS.find((channel) => channel === raw);
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
