"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAskAlaiy } from "@/hooks/use-ask-alaiy";

type AskAlaiyContextValue = ReturnType<typeof useAskAlaiy>;

const AskAlaiyContext = createContext<AskAlaiyContextValue | null>(null);

/**
 * One `useAskAlaiy()` instance for the whole /os tree, mounted alongside
 * AskAlaiyLauncher in the layout. Both the floating drawer and the
 * dedicated /os/ask-alaiy page read this same context instead of each
 * calling the hook themselves -- the hook owns a single per-tab session id
 * in sessionStorage (see SESSION_KEY in use-ask-alaiy.ts), so two live
 * instances would fight over it and double-poll.
 */
export function AskAlaiyProvider({ children }: { children: ReactNode }) {
  const chat = useAskAlaiy();
  return <AskAlaiyContext.Provider value={chat}>{children}</AskAlaiyContext.Provider>;
}

export function useAskAlaiyContext(): AskAlaiyContextValue {
  const ctx = useContext(AskAlaiyContext);
  if (!ctx) throw new Error("useAskAlaiyContext must be used within AskAlaiyProvider");
  return ctx;
}
