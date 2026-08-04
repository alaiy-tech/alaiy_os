import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface AskPanelState {
  isOpen: boolean;
  context: string;
  open: (context?: string) => void;
  close: () => void;
}

const AskPanelContext = createContext<AskPanelState | null>(null);

/**
 * Shared "Ask Alaiy" slide-out panel state. Any screen (Coming Soon's "Ask
 * Alaiy instead", a customer's "Summarise account", the floating handle,
 * the top bar) opens the same panel through this context rather than each
 * screen owning its own copy of the open/closed flag.
 */
export function AskPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState("Alaiy OS");

  const value = useMemo<AskPanelState>(
    () => ({
      isOpen,
      context,
      open: (ctx) => {
        if (ctx) setContext(ctx);
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }),
    [isOpen, context],
  );

  return <AskPanelContext.Provider value={value}>{children}</AskPanelContext.Provider>;
}

export function useAskPanel() {
  const ctx = useContext(AskPanelContext);
  if (!ctx) throw new Error("useAskPanel must be used within an AskPanelProvider");
  return ctx;
}
