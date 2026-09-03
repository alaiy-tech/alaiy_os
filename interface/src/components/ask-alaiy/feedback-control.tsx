"use client";

import { useState } from "react";

import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type AgentTrail, FeedbackApiError, type FeedbackScreen, submitFeedback } from "@/lib/frappe/feedback";

type Status = "idle" | "open" | "sending" | "sent" | "error";
type Sentiment = "Up" | "Down" | null;

/**
 * One feedback control per settled assistant reply -- caller decides
 * "settled" (see ask-alaiy-panel.tsx/ask-alaiy-chat.tsx) and only renders
 * this once a turn is no longer the one currently being generated. Shown
 * on every reply, tool-using or not: agentTrail.tools is just `[]` for a
 * plain-text answer, never a reason to skip rendering this.
 *
 * Thumbs up submits immediately -- a bare thumb is already a complete
 * signal. Thumbs down opens a text box first: the whole point of a
 * negative rating is finding out what was wrong, and a reason-less "no"
 * tells nobody building the prompts anything actionable.
 *
 * Branches primarily on `sentiment`, not `status` -- once Down is chosen
 * the textarea stays up through open/sending/error, while Up's sending and
 * error states render inline on the thumbs themselves. Branching on
 * `status` alone briefly rendered the textarea during an Up submission's
 * "sending" tick, which is wrong.
 *
 * See interface/docs/feedback-system.md for the full spec.
 */
export function FeedbackControl({
  session,
  message,
  agentTrail,
  screen,
}: {
  session: string;
  message: string;
  agentTrail: AgentTrail;
  screen: FeedbackScreen;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [sentiment, setSentiment] = useState<Sentiment>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status === "sent") {
    return <p className="mt-1.5 text-[12px] text-muted-foreground">Feedback sent — thanks.</p>;
  }

  const submit = async (chosen: NonNullable<Sentiment>, reason?: string) => {
    setStatus("sending");
    setError(null);
    try {
      await submitFeedback({ session, message, sentiment: chosen, feedback: reason, screen, agentTrail });
      setStatus("sent");
    } catch (e) {
      setError(e instanceof FeedbackApiError ? e.message : "Couldn't send that — try again.");
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
      <div className="mt-1.5 max-w-xl space-y-1.5">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="What was wrong with this reply?"
          rows={2}
          className="text-[12.5px]"
          disabled={sending}
          autoFocus
        />
        {status === "error" && error && <p className="text-[12px] text-destructive">{error}</p>}
        <div className="flex justify-end gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void submit("Down", trimmed)} disabled={sending || !trimmed}>
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : "Send"}
          </Button>
        </div>
      </div>
    );
  }

  // idle, an Up submission in flight, or an error from either thumb before
  // Down's textarea ever opened.
  const sending = status === "sending";
  return (
    <div className="mt-1.5 flex items-center gap-2.5">
      <button
        type="button"
        onClick={() => {
          setSentiment("Up");
          void submit("Up");
        }}
        disabled={sending}
        aria-label="Good reply"
        className="text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {sending && sentiment === "Up" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ThumbsUp className="size-3.5" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setSentiment("Down")}
        disabled={sending}
        aria-label="Bad reply"
        className="text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <ThumbsDown className="size-3.5" />
      </button>
      {status === "error" && error && <span className="text-[12px] text-destructive">{error}</span>}
    </div>
  );
}
