"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { suggestionsFor } from "@/lib/ask/suggestions";
import { Chat, Mark } from "@/components/ask/chat";

/**
 * Ask Alaiy docked to the right of the data tabs.
 *
 * It renders the same `Chat` as Home, on the same session — Home defaults to
 * the seller's newest chat and so does this, so a question asked here is
 * already open when they go back to Home. Neither surface tells the other
 * anything; asking a question is what makes that session the newest.
 *
 * It renders nothing on /home, which *is* the Ask surface. Two composers on
 * one screen, one a duplicate of the other, would be the wrong answer to "the
 * panel is persistent".
 *
 * A client component because that decision needs the current pathname, which a
 * server layout has no request-scoped way to read.
 */
export function AskPanel({
  greeting,
  sessionId,
  importing = false,
}: {
  greeting: string[];
  /** The seller's newest chat, or null if they have never asked anything. */
  sessionId: string | null;
  importing?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  // Escape leaves full screen. Bound only while expanded, so it does not
  // swallow the key everywhere else in the app.
  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  if (pathname === "/home") return null;

  const body = (
    <>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Mark size={7} />
          <div className="min-w-0">
            {/* The display face, small: this is a name, not a label. */}
            <h2 className="text-display-xs text-primary-600">Ask Alaiy</h2>
            <p className="truncate text-[10.5px] leading-tight text-muted">
              Answers from your own data
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Exit full screen" : "Expand to full screen"}
          title={expanded ? "Exit full screen (Esc)" : "Expand to full screen"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-muted transition-colors hover:bg-primary-600/5 hover:text-primary-600"
        >
          <svg
            viewBox="0 0 20 20"
            aria-hidden
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {expanded ? (
              <path d="M12 4h4v4M8 16H4v-4M16 4l-5 5M4 16l5-5" />
            ) : (
              <path d="M16 8V4h-4M4 12v4h4M16 4l-5 5M4 16l5-5" />
            )}
          </svg>
        </button>
      </header>

      {/* Keyed, so switching to a different chat starts a clean transcript
          rather than appending to the one on screen. */}
      <Chat
        key={sessionId ?? "new"}
        sessionId={sessionId}
        greeting={greeting}
        suggestions={suggestionsFor(pathname)}
        importing={importing}
        variant="panel"
      />
    </>
  );

  if (expanded) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ask Alaiy"
        className="fixed inset-0 z-50 flex flex-col bg-canvas"
      >
        {/* Held to a column at full screen. A transcript running the whole
            width of a desktop monitor is a worse read, not a bigger one. */}
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col border-x border-line">
          {body}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Paper, like everything else. The white answer cards read as cards
          against it without needing a tinted ground of their own. */}
      <aside
        aria-label="Ask Alaiy"
        // The width is a token, not a literal: the Orders detail panel slides
        // in beside this one and has to stop exactly at its edge.
        className="hidden h-full w-ask-panel shrink-0 flex-col border-l border-line bg-canvas lg:flex"
      >
        {body}
      </aside>

      {/* Below lg there is no room to dock it, so it opens full screen. */}
      {/* A navy panel with the press geometry: filled, because it floats over
          the page and an outline on paper would have nothing to sit against. */}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="press press-dark fixed bottom-5 right-5 z-40 h-12 bg-primary-600 pl-3 pr-5 text-[13px] lg:hidden"
      >
        <span
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-xs bg-highlight-300 font-sans text-[11px] font-bold text-primary-600"
        >
          A
        </span>
        Ask Alaiy
      </button>
    </>
  );
}
