const BASE = "/api/method/alaiy_os.api.agent_settings";

export class AgentSettingsApiError extends Error {
  /** HTTP status of the failed response — 403 renders the role notice, not an error toast. */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type PermissionRequirement = {
  doctype: string;
  ptype: string; // "read" | "write" | "create" | …
  granted: boolean; // does run_as_user hold it, right now
};

export type AgentTool = {
  tool_id: string;
  connector: string | null;
  declared: boolean; // false = the tool declares nothing. NOT the same as satisfied.
  permissions: PermissionRequirement[];
  writes: boolean; // any ptype other than read
};

export type Agent = {
  agent_id: string;
  agent_name: string;
  description: string | null;
  icon: string | null; // lucide-ish name, e.g. "trending-up" — may not resolve, fall back
  model: string | null;
  page: string | null; // ignore for now (see Out of scope)
  /** The app that registered this agent, or null for a row written by hand in the
   * Desk. An owned row is rewritten by its app on every reconcile, so editing one
   * here is work that disappears on the next migrate. */
  source_app: string | null;
  is_enabled: boolean;
  run_as_user: string; // "Administrator" when unset
  runs_as_administrator: boolean; // true = reads the whole site
  tools: AgentTool[];
  permissions_satisfied: boolean;
  unmet_permissions: string[]; // pre-formatted: "get_stock_cover: read on Bin"
  writes: boolean;
};

/** Pull a readable sentence out of a Frappe error body.
 *
 * The useful text is usually in `_server_messages`, a JSON-encoded array of
 * JSON-encoded objects, and Frappe writes those messages as HTML. Toasts
 * render as plain text, so the markup is stripped rather than shown raw. */
function extractErrorMessage(data: Record<string, unknown>, fallback: string): string {
  const raw = data._server_messages;
  if (typeof raw === "string") {
    try {
      const messages = JSON.parse(raw) as string[];
      const texts = messages.map((entry) => {
        try {
          return (JSON.parse(entry) as { message?: string }).message ?? entry;
        } catch {
          return entry;
        }
      });
      const text = toPlainText(texts.join(" "));
      if (text) return text;
    } catch {
      // malformed _server_messages — fall through to the plainer fields below
    }
  }

  if (typeof data.message === "string" && data.message) return toPlainText(data.message);
  if (typeof data.exc_type === "string" && data.exc_type) return data.exc_type;
  return fallback;
}

function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function call<T>(method: string, fallback: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}.${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new AgentSettingsApiError(extractErrorMessage(data, fallback), res.status);
  return data.message as T;
}

export function listAgents(): Promise<Agent[]> {
  return call<Agent[]>("list_agents", "Could not load agents.");
}

export function setAgentEnabled(
  agent: string,
  enabled: boolean,
  force = false,
): Promise<{ agent: string; is_enabled: boolean }> {
  return call<{ agent: string; is_enabled: boolean }>("set_agent_enabled", "Could not update the agent.", {
    agent,
    enabled,
    force,
  });
}

export function setAgentRunAsUser(agent: string, user: string): Promise<Agent> {
  return call<Agent>("set_agent_run_as_user", "Could not change the run-as user.", { agent, user });
}
