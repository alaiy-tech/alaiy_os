import { Sparkles } from "lucide-react";
import type { useAskAlaiy } from "./useAskAlaiy";
import { AskAlaiyPanel } from "./AskAlaiyPanel";

/**
 * Fixed to the bottom-right corner of every Desk page. Mounted once by
 * main.tsx (outside React's own Desk tree, since there isn't one), so it
 * survives Desk's own client-side route changes -- closing it just hides the
 * panel rather than tearing the conversation down.
 */
export function AskAlaiyLauncher({
  open, onOpenChange, chat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: ReturnType<typeof useAskAlaiy>;
}) {
  return (
    <>
      {!open && (
        <button onClick={() => onOpenChange(true)} aria-label="Open Ask Alaiy" aria-expanded={false} className="ask-alaiy-launcher">
          <Sparkles size={20} />
        </button>
      )}
      <AskAlaiyPanel open={open} onClose={() => onOpenChange(false)} chat={chat} />
    </>
  );
}
