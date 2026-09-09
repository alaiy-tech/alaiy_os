"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import type { ChatSessionSummary } from "@/lib/backend/types";
import { Eyebrow, pressClass } from "@/components/ui";

/**
 * The seller's past chats.
 *
 * Picking one is a navigation, not local state: the transcript is loaded by
 * the server for the id in `?chat=`, so a conversation has a URL that survives
 * a reload and can be reopened tomorrow.
 *
 * "New chat" is the opposite — a callback, because there is no id to navigate
 * to. Nothing is created until a question is asked, or every visit to Home
 * would leave an empty chat in this list.
 */
export function SessionRail({
  sessions,
  active,
  onNew,
  onDeleted,
}: {
  /**
   * The list, owned by ChatWorkspace. Deliberately not copied into state
   * here: a second copy would not see a chat the conversation just created,
   * and the row would be missing until the next navigation.
   */
  sessions: ChatSessionSummary[];
  active: string | null;
  /** Start an unstarted chat. Not a navigation — see ChatWorkspace. */
  onNew: () => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(id);
    try {
      const response = await fetch(`/api/chat/sessions?session=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) return;
      onDeleted(id);
      // Only when they deleted the chat they were reading. Otherwise the
      // transcript on screen is untouched, and reloading it would be a
      // flicker for nothing.
      if (id === active) router.push("/home");
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside
      aria-label="Your chats"
      className="hidden w-60 shrink-0 flex-col border-r border-line bg-canvas lg:flex"
    >
      <div className="shrink-0 px-3 py-3">
        <button type="button" onClick={onNew} className={`${pressClass({ size: "sm" })} w-full`}>
          <svg
            viewBox="0 0 20 20"
            aria-hidden
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
          >
            <path d="M10 4.5v11M4.5 10h11" />
          </svg>
          New chat
        </button>
      </div>

      <Eyebrow className="shrink-0 px-4 pb-1.5 pt-1">Recent</Eyebrow>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {sessions.length === 0 ? (
          <p className="px-2 text-[12px] leading-relaxed text-muted">
            Nothing yet. Ask a question and it will be saved here.
          </p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((row) => {
              const current = row.name === active;
              const when = row.last_activity ?? row.modified;
              return (
                <li key={row.name} className="group relative">
                  <button
                    type="button"
                    onClick={() => router.push(`/home?chat=${encodeURIComponent(row.name)}`)}
                    aria-current={current ? "true" : undefined}
                    className={`w-full rounded-sm border px-2.5 py-2 pr-8 text-left transition-colors ${
                      current
                        ? "border-primary-600 bg-white"
                        : "border-transparent hover:border-line hover:bg-white"
                    }`}
                    title={row.title ?? row.name}
                  >
                    <span
                      className={`block truncate text-[13px] ${
                        current
                          ? "font-medium text-primary-600"
                          : "text-muted group-hover:text-primary-600"
                      }`}
                    >
                      {row.title?.trim() || "Untitled chat"}
                    </span>
                    {/* Date only, never a "2h ago": the backend sends a naive
                        timestamp in the site's timezone, so anything computed
                        against the browser clock would be a guess. */}
                    {when ? (
                      <span className="mt-0.5 block font-data text-[10.5px] text-muted-soft">
                        {formatDate(when)}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row.name)}
                    disabled={busy === row.name}
                    aria-label={`Delete ${row.title?.trim() || "chat"}`}
                    // Visible on hover, and always once focused — a control that
                    // only appears on hover is unreachable by keyboard.
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-xs text-muted opacity-0 transition-all duration-150 hover:bg-alert-soft hover:text-alert-ink focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M4.5 6.5h11M8 6.5V5h4v1.5M6 6.5l.6 9h6.8l.6-9M8.5 9v4.5M11.5 9v4.5" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
