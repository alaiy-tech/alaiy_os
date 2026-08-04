import { useState } from "react";
import {
  Copy,
  Database,
  FilePlus2,
  History,
  Loader,
  PackageSearch,
  Paperclip,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  ArrowUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ASK_HISTORY, ASK_STARTERS, ASK_THREAD_META, ASK_THREAD_TITLE } from "@/config/ask-seed";
import { useAskConversation } from "@/hooks/use-ask-conversation";
import { useFrappeAuth } from "frappe-react-sdk";

const STARTER_ICONS = [PackageSearch, TrendingUp, FilePlus2, Search];
const TOOLS = [
  { label: "Copy", icon: Copy },
  { label: "Good answer", icon: ThumbsUp },
  { label: "Needs work", icon: ThumbsDown },
  { label: "Retry", icon: RotateCcw },
];

function actionIcon(action?: string) {
  if (!action) return Database;
  if (action.startsWith("Agent:")) return FilePlus2;
  if (action === "Planning") return Loader;
  return Database;
}

export default function AskAlaiyPage() {
  const { currentUser } = useFrappeAuth();
  const first = currentUser?.split("@")[0] ?? "there";
  const { messages, isEmpty, input, setInput, send, startNew } = useAskConversation();
  const [historyOpen, setHistoryOpen] = useState(false);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") send();
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="flex flex-none items-center gap-3 border-b border-line-faint px-8 py-3.5">
        <span className="flex size-7 flex-none items-center justify-center rounded-[7px] bg-navy text-blue">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold tracking-[-.015em] text-ink">{isEmpty ? "New chat" : ASK_THREAD_TITLE}</div>
          <div className="mt-0.5 text-[11.5px] text-ash-2">{isEmpty ? "Nothing asked yet" : ASK_THREAD_META}</div>
        </div>
        <div className="flex-1" />
        <Button variant="outline" className="h-[34px] gap-[7px] px-3 text-[12.5px]" onClick={() => setHistoryOpen((o) => !o)}>
          <History className="size-[15px] text-slate" />
          History
        </Button>
        <Button variant="outline" className="h-[34px] gap-[7px] px-[13px] text-[12.5px]" onClick={startNew}>
          <Plus className="size-[15px] text-slate" />
          New chat
        </Button>
      </div>

      {historyOpen && (
        <div className="flex-none border-b border-line-faint bg-surface-dashed px-8 py-3.5">
          <div className="mx-auto grid max-w-[760px] grid-cols-2 gap-2">
            {ASK_HISTORY.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={() => setHistoryOpen(false)}
                className={`rounded-[7px] p-[10px] text-left transition-colors hover:bg-line-subtle ${t.current ? "bg-line-subtle" : ""}`}
              >
                <div className="truncate text-[12.5px] font-medium text-ink">{t.title}</div>
                <div className="mt-0.5 text-[11px] text-ash-2">{t.meta}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-1 flex-col justify-center overflow-y-auto p-8">
          <div className="mx-auto w-full max-w-[720px]">
            <div className="text-center text-[30px] font-semibold tracking-[-.03em] text-ink">Good afternoon, {first}</div>
            <p className="mt-2 text-center text-[14px] text-ash">
              Ask anything about your catalog, orders, stock or customers — or hand a task to an agent.
            </p>

            <div className="mt-[30px] rounded-2xl border border-line-strong bg-white p-4 pb-3 shadow-[0_2px_12px_rgba(0,20,36,.05)] focus-within:border-blue focus-within:shadow-[0_0_0_4px_rgba(145,209,242,.28)]">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask Alaiy anything…"
                className="h-[30px] border-none px-0 text-[15px] shadow-none focus-visible:ring-0"
              />
              <div className="mt-2.5 flex items-center gap-2">
                <button type="button" title="Attach a document" className="flex size-[30px] items-center justify-center rounded-[8px] border border-line text-slate hover:bg-paper">
                  <Paperclip className="size-[15px]" />
                </button>
                <button type="button" className="flex h-[30px] items-center gap-1.5 rounded-[8px] border border-line px-2.5 text-[12px] font-medium text-slate-2 hover:bg-paper">
                  <Database className="size-[14px] text-slate" />
                  All doctypes
                </button>
                <div className="flex-1" />
                <span className="text-[11.5px] text-ash-3">Enter to send</span>
                <button type="button" onClick={send} className="flex size-8 items-center justify-center rounded-[9px] bg-navy text-white hover:bg-navy-hover">
                  <ArrowUp className="size-[15px]" />
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {ASK_STARTERS.map((s, i) => {
                const Icon = STARTER_ICONS[i];
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setInput(s.label)}
                    className="flex items-start gap-[11px] rounded-xl border border-line-subtle bg-white p-[15px] text-left transition-colors hover:border-blue hover:bg-[#FBFDFF]"
                  >
                    <Icon className="mt-0.5 size-4 flex-none text-navy" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium tracking-[-.012em] text-ink">{s.label}</span>
                      <span className="mt-[3px] block text-[11.5px] leading-[1.45] text-ash-2">{s.meta}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-8 py-[30px] pb-6">
            <div className="mx-auto flex max-w-[760px] flex-col gap-[26px]">
              {messages.map((m, i) => {
                const ActionIcon = actionIcon(m.action);
                return (
                  <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                    {m.role === "ai" && (
                      <div className="mb-[9px] flex items-center gap-2">
                        <span className="flex size-[22px] items-center justify-center rounded-[6px] bg-navy text-blue">
                          <Sparkles className="size-3" />
                        </span>
                        <span className="text-[11.5px] font-semibold tracking-[.05em] text-ash uppercase">Alaiy</span>
                      </div>
                    )}
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[84%] rounded-2xl bg-line-subtle px-4 py-3 text-[14.5px] leading-[1.6] tracking-[-.005em] text-ink"
                          : "max-w-full text-[14.5px] leading-[1.72] tracking-[-.005em] text-ink"
                      }
                    >
                      {m.text}
                    </div>
                    {m.action && (
                      <div className="mt-3 max-w-[560px] rounded-[10px] border border-line bg-surface-dashed p-[13px]">
                        <div className="flex items-center gap-2">
                          <ActionIcon className="size-[14px] text-navy" />
                          <span className="text-[12.5px] font-semibold tracking-[-.01em] text-ink">{m.action}</span>
                        </div>
                        <div className="mt-1.5 text-[12px] leading-[1.55] tabular-nums text-ash">{m.actionMeta}</div>
                        {m.action.startsWith("Agent:") && (
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" className="h-8 text-[12px] tracking-[.08em] uppercase">
                              Review drafts
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-[12.5px]">
                              Discard
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    {m.role === "ai" && (
                      <div className="mt-[11px] flex gap-[3px]">
                        {TOOLS.map((t) => (
                          <button
                            key={t.label}
                            type="button"
                            title={t.label}
                            className="flex size-7 items-center justify-center rounded-md text-ash-3 transition-colors hover:bg-paper hover:text-ink"
                          >
                            <t.icon className="size-3.5" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-none px-8 pb-[22px]">
            <div className="mx-auto max-w-[760px]">
              <div className="rounded-2xl border border-line-strong bg-white p-3.5 pb-2.5 shadow-[0_2px_12px_rgba(0,20,36,.05)] focus-within:border-blue focus-within:shadow-[0_0_0_4px_rgba(145,209,242,.28)]">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Reply to Alaiy…"
                  className="h-7 border-none px-0 text-[14.5px] shadow-none focus-visible:ring-0"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" title="Attach a document" className="flex size-[30px] items-center justify-center rounded-[8px] border border-line text-slate hover:bg-paper">
                    <Paperclip className="size-[15px]" />
                  </button>
                  <button type="button" className="flex h-[30px] items-center gap-1.5 rounded-[8px] border border-line px-2.5 text-[12px] font-medium text-slate-2 hover:bg-paper">
                    <Database className="size-[14px] text-slate" />
                    Item, Bin, Sales Order
                  </button>
                  <div className="flex-1" />
                  <button type="button" onClick={send} className="flex size-8 items-center justify-center rounded-[9px] bg-navy text-white hover:bg-navy-hover">
                    <ArrowUp className="size-[15px]" />
                  </button>
                </div>
              </div>
              <p className="mt-[9px] text-center text-[11.5px] text-ash-3">
                Alaiy reads only what your role permits. Every write lands in Draft for you to review.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
