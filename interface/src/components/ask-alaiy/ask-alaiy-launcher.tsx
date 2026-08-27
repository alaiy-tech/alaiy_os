"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useAskAlaiy } from "@/hooks/use-ask-alaiy";
import { AskAlaiyPanel } from "./ask-alaiy-panel";

/**
 * Fixed to the bottom-right corner of every /os page. Mounted once in the
 * os layout (outside any individual page's tree), so the conversation
 * survives client-side route navigation -- closing the panel just hides it.
 */
export function AskAlaiyLauncher({ userFullName }: { userFullName: string }) {
  const chat = useAskAlaiy();
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Ask Alaiy"
          aria-expanded={false}
          className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <Sparkles className="size-5" />
        </button>
      )}
      <AskAlaiyPanel open={open} onClose={() => setOpen(false)} chat={chat} userFullName={userFullName} />
    </>
  );
}
