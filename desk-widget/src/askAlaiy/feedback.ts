/**
 * Typed surface over `alaiy_os.api.feedback` -- see
 * interface/docs/feedback-system.md at the bench root for the full spec.
 * Same frappe.xcall pattern as chat.ts, for the same reason: this widget
 * runs inside an already-authenticated Desk page.
 */

const NS = "alaiy_os.api.feedback";

export type FeedbackScreen = "Desk" | "Interface Panel" | "Interface Page";
export type FeedbackSentiment = "Up" | "Down";

export interface AgentTrailToolCall {
  tool: string;
  input: unknown;
  failed: boolean;
}

/** Built client-side from the already-rendered turn -- see
 * feedback-system.md's "Which message" section for why this is a snapshot
 * sent as-is rather than re-derived server-side. */
export interface AgentTrail {
  text: string;
  tools: AgentTrailToolCall[];
}

export const submitFeedback = (params: {
  session: string;
  message: string;
  sentiment: FeedbackSentiment;
  /** Required for "Down" -- see submit_feedback's own docstring. Optional
   * for "Up": a bare thumb is already a complete signal. */
  feedback?: string;
  screen: FeedbackScreen;
  agentTrail: AgentTrail;
}) =>
  frappe.xcall<{ name: string }>(`${NS}.submit_feedback`, {
    session: params.session,
    message: params.message,
    sentiment: params.sentiment,
    feedback: params.feedback ?? "",
    screen: params.screen,
    agent_trail: JSON.stringify(params.agentTrail),
  });
