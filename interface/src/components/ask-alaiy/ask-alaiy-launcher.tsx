"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useAskAlaiyContext } from "./ask-alaiy-provider";
import { AskAlaiyPanel } from "./ask-alaiy-panel";

const FULL_PAGE_PATHNAME = "/os/ask-alaiy";

/**
 * Fixed to the bottom-right corner of every /os page except the dedicated
 * /os/ask-alaiy page, which already shows the full experience inline.
 * Mounted once in the os layout (outside any individual page's tree), so
 * the conversation survives client-side route navigation -- closing the
 * panel just hides it. Shares its chat state with that page via
 * AskAlaiyProvider, so switching between the two never loses the thread.
 */
export function AskAlaiyLauncher({ userFullName }: { userFullName: string }) {
  const chat = useAskAlaiyContext();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === FULL_PAGE_PATHNAME) return null;

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
