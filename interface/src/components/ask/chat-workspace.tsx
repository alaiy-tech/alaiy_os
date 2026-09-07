"use client";

import { useState } from "react";
import { Chat } from "@/components/ask/chat";
import { SessionRail } from "@/components/ask/session-rail";
import type { ChatSessionSummary } from "@/lib/backend/types";

/**
 * Home's two halves, and the state they share.
 *
 * ## A new chat cannot be a navigation
 *
 * "New" started out as `router.push("/home")`, which looks right and is not:
 * Home with no `?chat=` opens the seller's *newest* conversation, so clearing
 * the parameter reopened the one they were trying to leave, and the next
 * question went into it. Starting a chat is a client-side act — there is no id
 * to put in a URL until a question has been asked — so it happens here.
 *
 * ## And a created session cannot be a refresh
 *
 * `router.refresh()` after the first question would be the same trap from the
 * other side: the server would resolve that brand-new chat as the active one,
 * change the conversation's key, and remount it — wiping the answer being
 * written. So the rail's new row is added locally and the conversation on
 * screen is left alone.
 *
 * Picking an existing chat *is* a navigation, because that one has an id worth
 * a URL, and the remount it causes is exactly right: the transcript is being
 * replaced.
 */
export function ChatWorkspace({
  sessions,
  initialActive,
  greeting,
  suggestions,
  importing,
}: {
  sessions: ChatSessionSummary[];
  initialActive: string | null;
  greeting: string[];
  suggestions: string[];
  importing: boolean;
}) {
  const [rows, setRows] = useState(sessions);
  // Which chat the conversation is on. Null means an unstarted one.
  const [open, setOpen] = useState(initialActive);
  // Only for which row is highlighted. Never fed back into the key.
  const [active, setActive] = useState(initialActive);
  // Bumped by "New" so the conversation remounts empty. It cannot be derived
  // from `open` alone: starting a second new chat would give the same null and
  // leave the first one's transcript on screen.
  const [generation, setGeneration] = useState(0);

  return (
    <div className="flex h-full min-h-0 bg-canvas">
      <SessionRail
        sessions={rows}
        active={active}
        onNew={() => {
          setOpen(null);
          setActive(null);
          setGeneration((n) => n + 1);
        }}
        onDeleted={(id) => setRows((current) => current.filter((row) => row.name !== id))}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Chat
          key={open ?? `new-${generation}`}
          sessionId={open}
          greeting={greeting}
          suggestions={suggestions}
          importing={importing}
          variant="hero"
          onSessionStarted={(id, title) => {
            setRows((current) => [
              {
                name: id,
                title,
                model: "",
                status: "Idle",
                last_activity: null,
                // The rail shows a date, and this row is not from the backend.
                // Written in the browser's own calendar day rather than from
                // `toISOString`, which is UTC and would show yesterday for a
                // question asked late in the evening.
                modified: localDay(),
              },
              ...current,
            ]);
            setActive(id);
          }}
        />
      </div>
    </div>
  );
}

/** Today, as the naive "YYYY-MM-DD" the rest of the app's dates arrive in. */
function localDay(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
