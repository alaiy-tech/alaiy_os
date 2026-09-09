import "server-only";
import { cache } from "react";
import { backend } from "@/lib/backend/client";
import type { ChannelId, ImportJob } from "@/lib/backend/types";

/** Spec: initial import covers the last 90 days on every tier. */
export const IMPORT_WINDOW_DAYS = 90;

/**
 * Kicks off the async import. Returns immediately with a job id — the backend
 * queues the work and sends the completion email itself.
 */
export async function startImport(
  workspaceId: string,
  channels: ChannelId[],
  userToken?: string,
): Promise<ImportJob> {
  return backend.post(
    "/api/method/alaiy_os_self_serve_apis.api.imports.start",
    { workspace: workspaceId, channels, days: IMPORT_WINDOW_DAYS },
    { userToken },
  );
}

export async function getImportStatus(
  workspaceId: string,
  jobId: string,
  userToken?: string,
): Promise<ImportJob> {
  return backend.get("/api/method/alaiy_os_self_serve_apis.api.imports.status", {
    query: { workspace: workspaceId, job: jobId },
    userToken,
  });
}

/** The most recent job for a workspace, so a refresh resumes the progress screen. */
export async function getLatestImport(
  workspaceId: string,
  userToken?: string,
): Promise<ImportJob | null> {
  return backend.get("/api/method/alaiy_os_self_serve_apis.api.imports.latest", {
    query: { workspace: workspaceId },
    userToken,
  });
}

/** What a single channel can be told to re-pull. Matches api/imports.py KINDS. */
export type SyncKind = "products" | "orders";

/**
 * Re-run one channel/kind now, outside an import.
 *
 * This is what the Channels tab's "Sync now" does. It returns as soon as the
 * job is queued — the work happens on the backend's long queue, so the caller
 * gets a job id rather than a result, and the row's "last synced" is what
 * eventually tells the seller it landed.
 */
export async function resyncChannel(
  workspaceId: string,
  channel: ChannelId,
  kind: SyncKind,
  userToken?: string,
): Promise<{ queued: boolean; job: string }> {
  return backend.post(
    "/api/method/alaiy_os_self_serve_apis.api.imports.resync",
    { workspace: workspaceId, channel, kind },
    { userToken },
  );
}

/**
 * The seller's current import, or null when they have none.
 *
 * `cache`d in its resolved form because several places in one render need it:
 * the status box in the app layout, and the "still importing" banner on Orders
 * and Inventory. That is one backend call, not three.
 *
 * Returns null on failure rather than throwing. Not knowing whether an import
 * is running is a reason to show no banner, never a reason to fail the page
 * the seller actually asked for.
 */
export const loadCurrentImport = cache(
  async (workspaceId: string, userToken?: string): Promise<ImportJob | null> => {
    try {
      return await getLatestImport(workspaceId, userToken);
    } catch {
      return null;
    }
  },
);

/** True while the seller's data is still landing. */
export function isImporting(job: ImportJob | null): boolean {
  return job?.status === "queued" || job?.status === "running";
}
