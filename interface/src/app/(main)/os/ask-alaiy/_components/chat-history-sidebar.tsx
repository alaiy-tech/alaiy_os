"use client";

import { useEffect, useRef, useState } from "react";

import { Plus, Search } from "lucide-react";

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
  const { state: appSidebarState, isMobile } = useSidebar();
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const el = placeholderRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
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
      <div ref={placeholderRef} className="hidden w-64 shrink-0 p-4 md:block" aria-hidden />

      {box && (
        <div
          className="fixed z-10 hidden w-64 flex-col gap-4 border-r bg-background p-4 md:flex"
          style={{ top: box.top, left: box.left, width: box.width, height: `calc(100vh - ${box.top}px)` }}
        >
          <InputGroup className="h-8 shrink-0">
            <InputGroupAddon>
              <Search className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search chats..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </InputGroup>
          <Button type="button" onClick={() => chat.newChat()} className="w-full shrink-0 rounded-xl">
            <Plus data-icon="inline-start" />
            New Chat
          </Button>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {orderedGroups.map(([label, rows]) => (
              <div key={label} className="space-y-1">
                <p className="px-2 font-medium text-muted-foreground text-xs">
                  {label}
                </p>
                {rows.map((session) => (
                  <button
                    key={session.name}
                    type="button"
                    onClick={() => void chat.load(session.name)}
                    className={cn(
                      "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                      chat.sessionId === session.name && "bg-accent",
                    )}
                  >
                    {session.title || "New chat"}
                  </button>
                ))}
              </div>
            ))}
            {!chat.sessionsLoading && matching.length === 0 && (
              <p className="px-2 text-muted-foreground text-sm">
                {q ? "No chats found." : "Your chats will appear here."}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
