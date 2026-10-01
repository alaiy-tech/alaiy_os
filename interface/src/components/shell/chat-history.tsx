"use client";

import { useSyncExternalStore } from "react";
import { formatDate, formatRelativeDate } from "@/lib/format";
import { useChatNav } from "@/components/ask/chat-nav";

/**
 * The seller's past chats, as a section of the left rail.
 *
 * It used to be a second rail of its own on /home, which meant the product had
 * two left-hand columns side by side on its main screen and none of that
 * history anywhere else — a chat started from the docked Ask panel on Orders
 * was unreachable until the seller went back to Home. One rail, so the chats
 * are wherever the seller is.
 *
 * On ink, so it takes the rail's treatment rather than the paper one the old
 * surface had: white at low opacity for a resting row, and for the open one
 * the same light plate with ink text that the nav rows above use. Which chat
 * that is, and everything that changes it, lives in `useChatNav` — this is the
 * list and nothing else.
 *
 * A row is one line. The old surface gave each chat a title and a date stacked
 * under it; in a column that is also carrying the nav that is twice the height
 * for the half of it nobody scans by. So the date goes to the right of the
 * title, and steps aside for the delete button on hover.
 */
export function ChatHistory() {
  const { rows, openId, openChat, deleteChat, deleting } = useChatNav();
  // Null on the server and through hydration, so both renders agree on the
  // plain "YYYY-MM-DD" date; only afterwards do the rows upgrade to
  // "Today"/"Yesterday"/a weekday, read off the viewer's own clock rather
  // than guessed at during the server pass. `useSyncExternalStore` is what
  // says "this value differs between server and client" directly, instead of
  // a mounted flag that has to be written from an effect.
  const today = useSyncExternalStore(subscribeNever, clientToday, serverToday);

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-1">
      <p className="shrink-0 px-3 pb-1.5 text-meta font-semibold uppercase tracking-[0.14em] text-white/40">
        Recent Chats
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto pb-1">
        {rows.length === 0 ? (
          <p className="px-3 text-[12px] leading-relaxed text-white/40">
            Nothing yet. Ask a question and it will be saved here.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {rows.map((row) => {
              const current = row.name === openId;
              const when = row.last_activity ?? row.modified;
              const title = row.title?.trim() || "Untitled chat";
              return (
                <li key={row.name} className="group relative">
                  <button
                    type="button"
                    onClick={() => openChat(row.name)}
                    aria-current={current ? "true" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-sm py-1.5 pl-3 pr-8 text-left transition-colors ${
                      current
                        ? "bg-active font-medium text-primary-600"
                        : "text-white/65 hover:bg-white/10 hover:text-white"
                    }`}
                    title={when ? `${title} — ${formatDate(when)}` : title}
                  >
                    <ChatBubble />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{title}</span>
                    {/* Never "2h ago" — the backend sends a naive timestamp in
                        the site's timezone, and anything computed to the hour
                        against the browser clock would be a real guess. A
                        day-level label is coarse enough to read off the
                        viewer's own calendar day safely; the exact date is in
                        the row's tooltip. Out of the way on hover, where the
                        delete button takes this corner. */}
                    {when ? (
                      <span
                        aria-hidden
                        className={`shrink-0 font-data text-meta transition-opacity group-hover:opacity-0 ${
                          current ? "text-primary-600/60" : "text-white/35"
                        }`}
                      >
                        {today ? formatRelativeDate(when, today) : formatDate(when)}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteChat(row.name)}
                    disabled={deleting === row.name}
                    aria-label={`Delete ${title}`}
                    // Visible on hover, and always once focused — a control
                    // that only appears on hover is unreachable by keyboard.
                    className="absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-xs text-white/50 opacity-0 transition-all duration-150 hover:bg-white/15 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-30"
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
    </div>
  );
}

/* The viewer's calendar day, fixed for the session.
 *
 * `getSnapshot` has to return the same reference every call or React re-renders
 * without end, so the `Date` is made once and kept. The cost is that a tab left
 * open across midnight goes on saying "Today" about yesterday — cheaper than a
 * timer ticking in the rail for a label nobody is watching change. */
let fixed: Date | null = null;
const clientToday = () => (fixed ??= new Date());
const serverToday = () => null;
/** Nothing ever invalidates the snapshot, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};

/** The one icon that is filled rather than stroked: at 14px a hollow bubble
 *  repeated down a list reads as noise, and these rows are scanned by title. */
function ChatBubble() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-70" fill="currentColor">
      <path d="M10 3.2c-3.9 0-7 2.4-7 5.4 0 1.7 1 3.2 2.6 4.2l-.7 2.6a.4.4 0 0 0 .6.45l2.9-1.7c.5.1 1 .15 1.6.15 3.9 0 7-2.4 7-5.7S13.9 3.2 10 3.2Z" />
    </svg>
  );
}
