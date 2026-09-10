import "server-only";
import { backend } from "@/lib/backend/client";
import type { ChannelId, ConnectorStatus } from "@/lib/backend/types";

/**
 * Channel connections.
 *
 * Credentials go one way only. They are posted to the connector, which stores
 * them encrypted against the seller's own Alaiy Channel Connection; nothing
 * here ever reads one back, and `list` returns status plus a display label.
 *
 * The SP-API app credentials are not in this app's environment at all — they
 * live in the bench's site_config, so the whole Amazon OAuth dance happens
 * backend-side and we only ever handle the URL to send the seller to.
 */

const API = "/api/method/alaiy_os_self_serve_apis.api.connections";
const SHOPIFY_API = "/api/method/alaiy_os.api.connections";

export async function listConnectors(
  workspaceId: string,
  userToken?: string,
): Promise<ConnectorStatus[]> {
  const result = await backend.get<ConnectorStatus[] | null>(`${API}.list_connections`, {
    query: { workspace: workspaceId },
    userToken,
  });
  return result ?? [];
}

/**
 * Start Shopify OAuth — returns the authorisation URL to redirect the seller to.
 *
 * The seller enters their store domain, we ask the connector to build the
 * OAuth URL (storing a nonce → workspace mapping in Redis), and redirect the
 * browser out. Shopify sends the merchant back to the connector's callback,
 * which exchanges the code for a permanent token and redirects here with
 * ?connected=shopify.
 */
export async function shopifyConnectUrl(
  workspaceId: string,
  shop: string,
  userToken?: string,
): Promise<{ url: string }> {
  return backend.post(
    `${SHOPIFY_API}.shopify_connect_url`,
    { workspace: workspaceId, shop },
    { userToken },
  );
}

/**
 * The Seller Central consent URL for this seller.
 *
 * Amazon redirects back to the *connector*, not to this app, because that is
 * where the LWA client secret lives. We only redirect the browser out.
 */
export async function amazonConnectUrl(
  workspaceId: string,
  region: "NA" | "EU" | "FE",
  userToken?: string,
): Promise<{ url: string }> {
  return backend.post(
    `${API}.amazon_connect_url`,
    { workspace: workspaceId, region },
    { userToken },
  );
}

/** Whether the bench has SP-API app credentials configured — never their values. */
export async function amazonAppStatus(
  userToken?: string,
): Promise<{ ready: boolean; missing: string[]; sandbox: boolean; draft: boolean }> {
  return backend.get(`${API}.amazon_app_status`, { userToken });
}

/** Drops the stored credentials. Already-synced rows are kept. */
export async function disconnectChannel(
  workspaceId: string,
  channel: ChannelId,
  userToken?: string,
): Promise<ConnectorStatus> {
  return backend.post(
    `${API}.disconnect`,
    { workspace: workspaceId, channel },
    { userToken },
  );
}
