"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * The floating panel shell used by every mock-data tab's detail and creation
 * panels (Support's case view and add-case form; Ratings' add-note form).
 * Modelled on the Orders detail panel: fixed to the right edge, stops short
 * of Ask Alaiy rather than covering it, and takes the one shadow the system
 * draws for a surface that is genuinely floating over the page.
 *
 * Unlike Orders' panel, there is nothing to put in a URL for any of these —
 * the data behind them is client-side mock state, so a link to "this one"
 * would point at nothing once the tab is closed. This closes on a callback
 * instead of a link, and Escape calls the same callback rather than pushing
 * a route.
 */
export function SlideOver({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside
      role="dialog"
      aria-label={title}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[27rem] flex-col border-l border-line bg-canvas shadow-float lg:right-ask-panel"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
            {eyebrow}
          </p>
          <h2 className="truncate font-data text-[17px] font-semibold text-primary-600">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
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
          >
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">{children}</div>
    </aside>
  );
}
