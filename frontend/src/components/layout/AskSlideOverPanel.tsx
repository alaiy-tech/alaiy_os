import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Database, FilePlus2, Loader, Paperclip, Sparkles, X, ArrowUp } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ASK_QUICK_SUGGESTIONS } from "@/config/ask-seed";
import { useAskConversation } from "@/hooks/use-ask-conversation";
import { useAskPanel } from "@/contexts/ask-panel-context";

function actionIcon(action?: string) {
  if (action?.startsWith("Agent:")) return FilePlus2;
  if (action === "Planning") return Loader;
  return Database;
}

export default function AskSlideOverPanel() {
  const { isOpen, context, close } = useAskPanel();
  const { messages, input, setInput, send } = useAskConversation();
  const navigate = useNavigate();
  const [width, setWidth] = useState(432);
  const dragState = useRef<{ startX: number; startW: number } | null>(null);

  if (!isOpen) return null;

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startW: width };
    const move = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const next = dragState.current.startW + (dragState.current.startX - ev.clientX);
      setWidth(Math.min(Math.max(next, 340), 880));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div onClick={close} className="absolute inset-0 animate-om-fade bg-[rgba(9,20,32,.28)]" />
      <div
        style={{ width }}
        className="relative flex max-w-[100vw] animate-om-slide-in flex-col border-l border-line bg-white shadow-[-24px_0_60px_rgba(0,20,36,.16)]"
      >
        <div
          onMouseDown={onResizeStart}
          title="Drag to resize"
          className="absolute inset-y-0 -left-[3px] z-[5] flex w-2 cursor-col-resize items-center justify-center hover:bg-blue/35"
        >
          <span className="h-[34px] w-[3px] rounded-sm bg-line-strong" />
        </div>

        <div className="flex flex-none items-center gap-2.5 border-b border-line-faint px-4 py-3.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-navy text-blue">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold tracking-[-.012em] text-ink">Ask Alaiy</div>
            <div className="text-[11.5px] text-ash">Context: {context}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              close();
              navigate("/ask-alaiy");
            }}
            className="px-1.5 py-[5px] text-[12px] font-medium text-navy hover:underline hover:decoration-blue hover:decoration-2 hover:underline-offset-[3px]"
          >
            Full page
          </button>
          <button type="button" onClick={close} className="flex size-7 items-center justify-center rounded-md text-slate hover:bg-paper">
            <X className="size-[15px]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => {
              const ActionIcon = actionIcon(m.action);
              return (
                <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[88%] rounded-[12px_12px_3px_12px] bg-navy px-[13px] py-[10px] text-[13px] leading-[1.55] text-white"
                        : "max-w-[94%] rounded-[12px_12px_12px_3px] bg-paper px-[13px] py-[11px] text-[13px] leading-[1.6] text-ink"
                    }
                  >
                    {m.text}
                  </div>
                  {m.action && (
                    <div className="mt-2.5 rounded-lg border border-line bg-surface-faint p-3">
                      <div className="flex items-center gap-2">
                        <ActionIcon className="size-3.5 text-navy" />
                        <span className="text-[12px] font-medium text-ink">{m.action}</span>
                      </div>
                      <div className="mt-1.5 text-[11.5px] leading-[1.5] text-ash">{m.actionMeta}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-none border-t border-line-faint px-4 pb-4 pt-3">
          <div className="mb-2.5 flex flex-wrap gap-[7px]">
            {ASK_QUICK_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="rounded-full border border-line px-[11px] py-[5px] text-[11.5px] text-ink transition-colors hover:border-blue hover:bg-surface-hoverBlue"
              >
                {s}
              </button>
            ))}
          </div>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about any doctype, or tell an agent what to do…"
            className="h-[26px] border-none px-0 text-[13px] shadow-none focus-visible:ring-0"
          />
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className="flex size-[30px] items-center justify-center rounded-lg border border-line text-slate hover:bg-paper">
              <Paperclip className="size-[15px]" />
            </button>
            <button type="button" className="flex h-[30px] items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12px] font-medium text-slate-2 hover:bg-paper">
              <Database className="size-[14px]" />
              All doctypes
            </button>
            <div className="flex-1" />
            <button type="button" onClick={send} className="flex size-8 items-center justify-center rounded-[9px] bg-navy text-white hover:bg-navy-hover">
              <ArrowUp className="size-[15px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
