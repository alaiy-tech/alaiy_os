import { useState } from "react";

import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

import { submitFeedback, type AgentTrail, type FeedbackScreen } from "./feedback";

type Status = "idle" | "open" | "sending" | "sent" | "error";
type Sentiment = "Up" | "Down" | null;

/**
 * Desk-bundle equivalent of interface/src/components/ask-alaiy/
 * feedback-control.tsx -- same state machine and API contract, hand-rolled
 * markup against styles.css since this can't import a React component from
 * the interface/ Next.js app across the build boundary. See
 * interface/docs/feedback-system.md for the full spec.
 *
 * One per settled assistant reply -- caller decides "settled" (see
 * AskAlaiyPanel.tsx) and only renders this once a turn is no longer the one
 * currently being generated. Shown on every reply, tool-using or not:
 * agentTrail.tools is just `[]` for a plain-text answer, never a reason to
 * skip rendering this.
 *
 * Branches primarily on `sentiment`, not `status` -- once Down is chosen the
 * textarea stays up through open/sending/error, while Up's sending and
 * error states render inline on the thumbs themselves.
 */
export function FeedbackControl({
  session,
  message,
  agentTrail,
}: {
  session: string;
  message: string;
  agentTrail: AgentTrail;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [sentiment, setSentiment] = useState<Sentiment>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status === "sent") {
    return <p className="ask-alaiy-feedback-sent">Feedback sent — thanks.</p>;
  }

  const submit = async (chosen: NonNullable<Sentiment>, reason?: string) => {
    setStatus("sending");
    setError(null);
    try {
      const screen: FeedbackScreen = "Desk";
      await submitFeedback({ session, message, sentiment: chosen, feedback: reason, screen, agentTrail });
      setStatus("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that — try again.");
      setStatus("error");
    }
  };

  const cancel = () => {
    setText("");
    setError(null);
    setSentiment(null);
    setStatus("idle");
  };

  if (sentiment === "Down") {
    const trimmed = text.trim();
    const sending = status === "sending";
    return (
      <div className="ask-alaiy-feedback-form">
        <textarea
          className="ask-alaiy-feedback-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="What was wrong with this reply?"
          rows={2}
          disabled={sending}
          // biome-ignore lint/a11y/noAutofocus: opened by an explicit click, not on page load
          autoFocus
        />
        {status === "error" && error && <p className="ask-alaiy-feedback-error">{error}</p>}
        <div className="ask-alaiy-feedback-actions">
          <button type="button" className="ask-alaiy-feedback-cancel" onClick={cancel} disabled={sending}>
            Cancel
          </button>
          <button
            type="button"
            className="ask-alaiy-feedback-send"
            onClick={() => void submit("Down", trimmed)}
            disabled={sending || !trimmed}
          >
            {sending ? <Loader2 size={13} className="ask-alaiy-spin" /> : "Send"}
          </button>
        </div>
      </div>
    );
  }

  // idle, an Up submission in flight, or an error from either thumb before
  // Down's textarea ever opened.
  const sending = status === "sending";
  return (
    <div className="ask-alaiy-feedback-thumbs">
      <button
        type="button"
        className="ask-alaiy-feedback-thumb-btn"
        onClick={() => {
          setSentiment("Up");
          void submit("Up");
        }}
        disabled={sending}
        aria-label="Good reply"
      >
        {sending && sentiment === "Up" ? <Loader2 size={13} className="ask-alaiy-spin" /> : <ThumbsUp size={13} />}
      </button>
      <button
        type="button"
        className="ask-alaiy-feedback-thumb-btn"
        onClick={() => setSentiment("Down")}
        disabled={sending}
        aria-label="Bad reply"
      >
        <ThumbsDown size={13} />
      </button>
      {status === "error" && error && <span className="ask-alaiy-feedback-error">{error}</span>}
    </div>
  );
}
