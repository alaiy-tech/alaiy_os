import { useState } from "react";

import { ASK_FOLLOWUP, ASK_SEED_THREAD, type AskMessage } from "@/config/ask-seed";

/**
 * Shared conversation state for both the full-page Ask Alaiy screen and the
 * docked slide-out panel, so "New chat" / sending a message behaves
 * identically in both places. See config/ask-seed.ts for why this is
 * scripted rather than backend-wired.
 */
export function useAskConversation() {
  const [thread, setThread] = useState<AskMessage[] | null>(null);
  const [input, setInput] = useState("");

  const messages = thread ?? ASK_SEED_THREAD;

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setThread([...(thread ?? ASK_SEED_THREAD), { role: "user", text }, ASK_FOLLOWUP]);
    setInput("");
  };

  const startNew = () => setThread([]);

  return { messages, isEmpty: messages.length === 0, input, setInput, send, startNew };
}
