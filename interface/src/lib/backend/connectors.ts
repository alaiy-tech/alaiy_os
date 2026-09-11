import "server-only";
import { backend } from "@/lib/backend/client";
import type {
  ChannelId,
  ChannelPermission,
  ConnectorStatus,
  PermissionDecision,
} from "@/lib/backend/types";

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
 * Attach a Shopify store with a custom app's Client ID and Client Secret.
 *
 * Shopify OAuth is a later stage; until then the seller creates a custom app
 * in their Shopify admin and hands over its two API credentials. Not the
 * Admin API access token, which this used to send: tokens minted from those
 * credentials last about a day, so the pair that mints them is what keeps a
 * store connected. The backend proves them against the shop before saving, so
 * a wrong secret fails here rather than at first sync.
 */
export async function connectShopify(
  workspaceId: string,
  shop: string,
  clientId: string,
  clientSecret: string,
  userToken?: string,
): Promise<ConnectorStatus> {
  return backend.post(
    `${API}.connect_shopify`,
    {
      workspace: workspaceId,
      shop,
      client_id: clientId,
      client_secret: clientSecret,
    },
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

/**
 * The channel's consent screen, as a list, with what the seller currently lets
 * Alaiy do with each entry.
 *
 * Answers for a channel that has never been connected too — the catalogue is a
 * property of the channel, not of the connection — so the section does not
 * appear out of nowhere the moment a connection succeeds.
 */
export async function listPermissions(
  workspaceId: string,
  channel: ChannelId,
  userToken?: string,
): Promise<ChannelPermission[]> {
  const result = await backend.get<ChannelPermission[] | null>(
    `${API}.list_permissions`,
    { query: { workspace: workspaceId, channel }, userToken },
  );
  return result ?? [];
}

/** Change one permission. Answers with the whole list, already re-read. */
export async function setPermission(
  workspaceId: string,
  channel: ChannelId,
  permission: string,
  decision: PermissionDecision,
  userToken?: string,
): Promise<ChannelPermission[]> {
  return backend.post(
    `${API}.set_permission`,
    { workspace: workspaceId, channel, permission, decision },
    { userToken },
  );
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
