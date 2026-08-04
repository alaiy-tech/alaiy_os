import { useLocation } from "react-router-dom";
import { ChevronLeft, Sparkles } from "lucide-react";

import { useAskPanel } from "@/contexts/ask-panel-context";

export default function AskFloatingHandle() {
  const { isOpen, open } = useAskPanel();
  const location = useLocation();

  if (isOpen || location.pathname === "/ask-alaiy") return null;

  return (
    <button
      type="button"
      onClick={() => open()}
      title="Ask Alaiy — open panel"
      className="group fixed top-1/2 right-0 z-[60] flex w-[26px] -translate-y-1/2 flex-col items-center gap-[7px] rounded-l-[9px] border border-r-0 border-line-strong bg-white py-3.5 text-navy shadow-[-4px_0_14px_rgba(0,20,36,.07)] transition-all hover:w-8 hover:bg-surface-hoverBlue"
    >
      <ChevronLeft className="size-4" />
      <span className="h-[26px] w-[3px] rounded-sm bg-line-subtle" />
      <Sparkles className="size-4" />
    </button>
  );
}
