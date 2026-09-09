import "server-only";
import { backend } from "@/lib/backend/client";
import type { BackendWorkspace, OrderFlagRules } from "@/lib/backend/types";

/** Current provisioning state, and whether onboarding is behind them. */
export async function getWorkspace(
  workspaceId: string,
  userToken?: string,
): Promise<BackendWorkspace> {
  return backend.get("/api/method/alaiy_os_self_serve_apis.api.workspace.get", {
    query: { workspace: workspaceId },
    userToken,
  });
}

/** The profile step. Google users skip it — SSO already supplied this. */
export async function saveProfile(
  workspaceId: string,
  profile: { full_name: string; company: string; role: string },
  userToken?: string,
): Promise<BackendWorkspace> {
  return backend.post(
    "/api/method/alaiy_os_self_serve_apis.api.workspace.save_profile",
    { workspace: workspaceId, ...profile },
    { userToken },
  );
}

/**
 * When an order counts as a problem, for everyone in this workspace.
 *
 * Workspace-level rather than per-seat: the Orders tab is read by whoever is
 * on shift, and two people looking at the same table have to be looking at the
 * same "stuck". Omitted fields are left as they were, so the tab can save one
 * threshold without sending the other two.
 */
export async function saveFlagRules(
  workspaceId: string,
  rules: Partial<OrderFlagRules>,
  userToken?: string,
): Promise<BackendWorkspace> {
  return backend.post(
    "/api/method/alaiy_os_self_serve_apis.api.workspace.save_flag_rules",
    { workspace: workspaceId, ...rules },
    { userToken },
  );
}

// `save_channels` is deliberately not wrapped any more. Channel selection was
// folded into the connect step, and the intent it recorded was never read: the
// import derives its channels from the connections that actually exist. The
// backend method stays whitelisted for older clients; nothing here calls it.
