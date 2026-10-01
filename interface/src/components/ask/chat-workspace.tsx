"use client";

import type { ReactNode } from "react";
import { Chat } from "@/components/ask/chat";
import { useChatNav } from "@/components/ask/chat-nav";

/**
 * Home: the conversation, and nothing beside it.
 *
 * The seller's past chats used to be a rail here. They are a section of the
 * left rail now, so this screen is the transcript alone — which is what it is
 * for, and one fewer left-hand column on the product's main page.
 *
 * Which chat is open, what remounts this and when, all live in `useChatNav`;
 * the reasoning for the key is there rather than here, because the docked Ask
 * panel keys the same component off the same answer.
 */
export function ChatWorkspace({
  greeting,
  suggestions,
  importing,
  belowHero,
}: {
  greeting: string[];
  suggestions: string[];
  importing: boolean;
  /** Server-rendered content shown under the composer on the first screen
   *  only — the KPI tiles, the alert bar, the trend chart. Never shown once
   *  a conversation has started, where the transcript is the screen. */
  belowHero?: ReactNode;
}) {
  const { openId, chatKey, sessionStarted } = useChatNav();

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <Chat
        key={chatKey}
        sessionId={openId}
        greeting={greeting}
        suggestions={suggestions}
        importing={importing}
        belowHero={belowHero}
        variant="hero"
        onSessionStarted={sessionStarted}
      />
    </div>
  );
}
