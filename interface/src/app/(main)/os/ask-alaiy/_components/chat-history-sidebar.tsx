"use client";

import { useEffect, useRef, useState } from "react";

import { Loader2, PanelLeftClose, PanelLeftOpen, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAskAlaiyContext } from "@/components/ask-alaiy/ask-alaiy-provider";
import type { ChatSessionSummary } from "@/lib/frappe/chat";

const GROUP_LABELS = ["Today", "This month", "Earlier"] as const;
const COLLAPSED_KEY = "ask-alaiy-history-collapsed";

/** The shell's header is h-12 (see DESIGN.md), so this is the highest the rail
 * may ever sit. Only used where the page scrolls and no ancestor's top is
 * stable enough to measure against. */
const STICKY_HEADER_PX = 48;

/** Nearest ancestor that actually scrolls, or null if the page itself does. */
function scrollParentOf(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent) {
    const overflowY = getComputedStyle(parent).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return null;
}

/**
 * True position:fixed, not sticky. Sticky depends on every ancestor in the
 * flex/overflow chain behaving -- one flex item without align-items:start
 * upstream is enough to silently make it inert (see ask-alaiy-view.tsx's
 * items-start comment). Fixed pins to the viewport unconditionally, the
 * same mechanism the app's own left-hand Sidebar already relies on.
 *
 * Fixed positioning still needs a left/top/width, and those shift with the
 * app sidebar's collapsed/expanded/mobile state -- so this renders an
 * invisible placeholder that stays in normal flow (reserving the layout
 * space) and mirrors its measured position onto the fixed overlay.
 */
export function ChatHistorySidebar() {
  const chat = useAskAlaiyContext();
  const [query, setQuery] = useState("");
  // Remembered per browser: someone who works with the rail shut shouldn't
  // have to shut it again every visit. localStorage throws in private mode, so
  // a failure just means "not collapsed".
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteFailed, setDeleteFailed] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* no-op */
    }
  }, [collapsed]);
  const { state: appSidebarState, isMobile } = useSidebar();
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const el = placeholderRef.current;
    if (!el) return;
    const scroller = scrollParentOf(el);

    const update = () => {
      const r = el.getBoundingClientRect();

      // Horizontal tracks the placeholder; vertical deliberately does not.
      // getBoundingClientRect() is viewport-relative, so the placeholder's
      // `top` shrinks as the conversation scrolls -- copying it would drag
      // this pinned rail up with the messages. A scroll container's own top
      // stands still while its content moves; with none (this shell lets the
      // page scroll), clamping at the header height gives the same guarantee
      // from the other side: the rail can never be pulled above the header.
      const top = scroller
        ? Math.max(scroller.getBoundingClientRect().top, 0)
        : Math.max(r.top, STICKY_HEADER_PX);

      // Returning the previous object when nothing moved lets React bail out
      // of the re-render -- the listeners below are deliberately broad.
      setBox((prev) =>
        prev && prev.top === top && prev.left === r.left && prev.width === r.width
          ? prev
          : { top, left: r.left, width: r.width },
      );
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    // The placeholder alone is not enough. Collapsing the app sidebar moves it
    // sideways without resizing it (it is a fixed w-64), and a ResizeObserver
    // never fires on a position-only change -- so the overlay kept the
    // pre-collapse `left` and sat out of alignment. The parent *does* change
    // width as the sidebar animates, and observing it fires on every frame of
    // that transition, so the overlay tracks the animation rather than
    // snapping to a stale reading. (Re-running this effect on
    // `appSidebarState` cannot fix it alone: React sees the new state at the
    // *start* of the transition, so measuring then reads the old geometry.)
    if (el.parentElement) observer.observe(el.parentElement);

    window.addEventListener("resize", update);
    const onTransitionEnd = () => update();
    document.addEventListener("transitionend", onTransitionEnd);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      document.removeEventListener("transitionend", onTransitionEnd);
    };
  }, [appSidebarState, isMobile]);

  useEffect(() => {
    chat.refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = query.trim().toLowerCase();
  const matching = q
    ? chat.sessions.filter((s) => (s.title || "New chat").toLowerCase().includes(q))
    : chat.sessions;

  const today = new Date().setHours(0, 0, 0, 0);
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const groups = new Map<(typeof GROUP_LABELS)[number], ChatSessionSummary[]>();
  matching.forEach((s) => {
    const stamp = new Date(s.last_activity || s.modified).setHours(0, 0, 0, 0);
    const label = stamp >= today ? "Today" : stamp >= thisMonthStart ? "This month" : "Earlier";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)?.push(s);
  });
  const orderedGroups = GROUP_LABELS.filter((label) => groups.has(label)).map(
    (label) => [label, groups.get(label) ?? []] as const,
  );

  return (
    <>
      {/* Reserves the horizontal space in normal flow so the chat column
          doesn't slide underneath the fixed overlay below. p-4 matches the
          fixed overlay's own padding so the measured box (and the space it
          reserves) actually accounts for it -- box-sizing:border-box means
          width itself doesn't need adjusting for it. */}
      <div
        ref={placeholderRef}
        aria-hidden
        // The width is what the overlay mirrors, so collapsing here is what
        // gives the space back to the conversation. Transitioning it makes the
        // overlay follow frame by frame via the ResizeObserver above -- this
        // time the width really does change, so it fires. Padding shrinks too:
        // p-4 inside a w-16 rail would leave 32px for a 28px button.
        className={cn(
          "hidden shrink-0 transition-[width] duration-200 ease-out md:block",
          collapsed ? "w-16 p-2" : "w-64 p-4",
        )}
      />

      {box && (
        <div
          className={cn(
            "fixed z-10 hidden flex-col gap-4 border-r bg-background md:flex",
            collapsed ? "p-2" : "p-4",
          )}
          style={{ top: box.top, left: box.left, width: box.width, height: `calc(100vh - ${box.top}px)` }}
        >
          {collapsed ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setCollapsed(false)}
                aria-label="Expand chat history"
                title="Expand chat history"
                className="shrink-0 self-center"
              >
                <PanelLeftOpen />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                onClick={() => chat.newChat()}
                aria-label="New chat"
                title="New chat"
                className="shrink-0 self-center rounded-xl"
              >
                <Plus />
              </Button>
            </>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-1.5">
                <InputGroup className="h-8 min-w-0 flex-1">
                  <InputGroupAddon>
                    <Search className="size-4" />
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Search chats..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </InputGroup>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse chat history"
                  title="Collapse chat history"
                  className="shrink-0 text-muted-foreground"
                >
                  <PanelLeftClose />
                </Button>
              </div>
              <Button type="button" onClick={() => chat.newChat()} className="w-full shrink-0 rounded-xl">
                <Plus data-icon="inline-start" />
                New Chat
              </Button>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                {orderedGroups.map(([label, rows]) => (
                  <div key={label} className="space-y-1">
                    <p className="px-2.5 pb-0.5 font-medium text-muted-foreground text-xs">{label}</p>
                    {rows.map((session) => {
                      const deleting = deletingId === session.name;
                      return (
                        <div
                          key={session.name}
                          // `group` drives the hover-reveal on the trash.
                          className={cn(
                            "group flex items-center gap-1 rounded-md pr-1 hover:bg-accent",
                            chat.sessionId === session.name && "bg-accent",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => void chat.load(session.name)}
                            className="min-w-0 flex-1 truncate rounded-md px-2.5 py-2 text-left text-sm"
                          >
                            {session.title || "New chat"}
                          </button>

                          {/* One click deletes. Kept mounted but transparent so
                              the row's width never shifts on hover, and
                              disabled mid-flight so a double click can't fire
                              two deletes. */}
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={async (event) => {
                              event.stopPropagation();
                              setDeleteFailed(null);
                              setDeletingId(session.name);
                              try {
                                await chat.remove(session.name);
                              } catch (error) {
                                // Without this the rejection is swallowed and
                                // the row just sits there looking ignored.
                                setDeleteFailed(
                                  error instanceof Error ? error.message : "Could not delete that chat.",
                                );
                              } finally {
                                setDeletingId(null);
                              }
                            }}
                            aria-label={`Delete ${session.title || "this chat"}`}
                            title="Delete chat"
                            className="flex-none rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 disabled:opacity-100 group-hover:opacity-100"
                          >
                            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {deleteFailed && <p className="px-2.5 text-destructive text-xs">{deleteFailed}</p>}
                {!chat.sessionsLoading && matching.length === 0 && (
                  <p className="px-2.5 text-muted-foreground text-sm">
                    {q ? "No chats found." : "Your chats will appear here."}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
