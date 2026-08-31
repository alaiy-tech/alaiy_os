import { frappeErrorMessage } from "@/lib/frappe/error-message";

const BASE = "/api/method/alaiy_os.api.feedback";

export class FeedbackApiError extends Error {}

async function call<T>(method: string, fallback: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}.${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new FeedbackApiError(frappeErrorMessage(data, fallback));
  return data.message as T;
}

export type FeedbackScreen = "Desk" | "Interface Panel" | "Interface Page";
export type FeedbackSentiment = "Up" | "Down";

export interface AgentTrailToolCall {
  tool: string;
  input: unknown;
  failed: boolean;
}

/** Built client-side from the already-grouped turn -- see
 * interface/docs/feedback-system.md's "Which message" section for why this
 * is a snapshot sent as-is rather than re-derived server-side. */
export interface AgentTrail {
  text: string;
  tools: AgentTrailToolCall[];
}

export function submitFeedback(params: {
  session: string;
  message: string;
  sentiment: FeedbackSentiment;
  /** Required for "Down" -- see submit_feedback's own docstring. Optional
   * for "Up": a bare thumb is already a complete signal. */
  feedback?: string;
  screen: FeedbackScreen;
  agentTrail: AgentTrail;
}): Promise<{ name: string }> {
  return call<{ name: string }>("submit_feedback", "Could not send that feedback.", {
    session: params.session,
    message: params.message,
    sentiment: params.sentiment,
    feedback: params.feedback ?? "",
    screen: params.screen,
    agent_trail: JSON.stringify(params.agentTrail),
  });
}
