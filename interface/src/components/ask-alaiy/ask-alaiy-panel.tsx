"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AtSign, Bot, Calendar, ChevronDown, Download, Edit3, File as FileIcon, Loader2,
  MoreHorizontal, Package, Paperclip, Plus, Search, Send, Slash, Sparkles, Store, Tag,
  Trash2, TriangleAlert, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { groupAssistantTurns, MAX_ATTACHMENTS, type useAskAlaiy, type PendingAttachment, type ThreadTurn } from "@/hooks/use-ask-alaiy";
import { listChatMentions } from "@/lib/frappe/chat";
import type {
  ChatAttachmentMeta, ChatMention, ChatSessionSummary, ChatSkill, MentionGroup, MentionOption,
} from "@/lib/frappe/chat";
import { AnswerBody } from "./answer-body";
import { AttachmentPreviewPane, useAttachmentPreview } from "./attachment-preview";
import { FeedbackControl } from "./feedback-control";
import "./ask-alaiy.css";

type MentionRow = MentionOption & { kind: string };

interface ComposedMention extends ChatMention {
  token: string;
}

const SUGGESTIONS = [
  "Which SKUs are running low on stock?",
  "How did sales go today?",
  "Any settlements that don't match?",
  "What's new since yesterday?",
];

export const ATTACHMENT_ACCEPT =
  ".pdf,.xlsx,.xlsm,.csv,.tsv,.txt,.md,.json,.yaml,.yml,.py,.js,.ts,.sql,.log,.xml,.html,.htm,.css,.ini,.cfg,.toml";

function skillQueryOf(value: string): string | null {
  const match = /^\/([a-z0-9-]*)$/.exec(value.trimStart());
  return match ? match[1] : null;
}

function exactSkillSlug(value: string, skills: ChatSkill[] | null): string | undefined {
  const match = /^\/([a-z0-9-]+)$/.exec(value.trim());
  if (!match || !skills) return undefined;
  return skills.some((s) => s.slug === match[1]) ? match[1] : undefined;
}

const MENTION_RE = /(?:^|[\s(\[{,;:"'“‘])@([^\s@]{0,40}(?:[ ][^\s@]{0,40}){0,2})?$/;
const MENTION_DEBOUNCE_MS = 120;
const CARET_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];

function mentionQueryAt(value: string, caret: number): { term: string; start: number; end: number } | null {
  const head = value.slice(0, caret);
  const match = MENTION_RE.exec(head);
  if (!match) return null;
  const at = match.index + match[0].indexOf("@");
  return { term: match[1] || "", start: at, end: caret };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderMentionedText(text: string, mentions: ChatMention[] | undefined): ReactNode {
  const tokens = Array.from(new Set((mentions ?? []).map((m) => `@${m.label}`))).sort((a, b) => b.length - a.length);
  if (!tokens.length) return text;

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "g");
  return text.split(pattern).map((part, i) =>
    tokens.includes(part) ? <span key={i} className="font-medium underline decoration-dotted underline-offset-2">{part}</span> : part,
  );
}

function MentionIcon({ name, className }: { name?: string | null; className?: string }) {
  const icons: Record<string, typeof Tag> = { tag: Tag, calendar: Calendar, box: Package, store: Store };
  const Icon = (name && icons[name]) || AtSign;
  return <Icon className={className ?? "size-4"} />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function attachmentMeta(fileSize: number, chars?: number, format?: string): string {
  const size = formatFileSize(fileSize);
  if (format) return `${format.toUpperCase()} · ${size}`;
  return chars ? `${size} · ${chars.toLocaleString()} characters read` : size;
}

function dayPartFor(hour: number): string {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function greeting(fullName: string, part: string | null) {
  const first = fullName.split(" ")[0] || fullName;
  return `${part ?? "Welcome"}, ${first}`;
}

export function AskAlaiyPanel({
  open, onClose, chat, userFullName,
}: {
  open: boolean;
  onClose: () => void;
  chat: ReturnType<typeof useAskAlaiy>;
  userFullName: string;
}) {
  const fileOpen = Boolean(useAttachmentPreview()?.file);
  const [text, setText] = useState("");
  const [dayPart, setDayPart] = useState<string | null>(null);
  useEffect(() => setDayPart(dayPartFor(new Date().getHours())), []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const skillQuery = skillQueryOf(text);
  const [skillMatches, setSkillMatches] = useState<ChatSkill[]>([]);
  const [skillIndex, setSkillIndex] = useState(0);
  const [skillDismissedFor, setSkillDismissedFor] = useState<string | null>(null);
  const skillsOpen = skillQuery !== null && text !== skillDismissedFor;

  useEffect(() => {
    if (skillQuery === null) {
      setSkillMatches([]);
      return;
    }
    let cancelled = false;
    void chat.ensureSkillsLoaded().then((all) => {
      if (cancelled || skillQueryOf(text) === null) return;
      const q = skillQuery.toLowerCase();
      setSkillMatches(all.filter((s) => s.slug.includes(q) || (s.label || "").toLowerCase().includes(q)));
      setSkillIndex(0);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillQuery]);

  const [mentionState, setMentionState] = useState<{
    query: { term: string; start: number; end: number };
    groups: MentionGroup[];
    options: MentionRow[];
    index: number;
  } | null>(null);
  const [mentionTokens, setMentionTokens] = useState<ComposedMention[]>([]);
  const mentionCache = useRef(new Map<string, MentionGroup[]>());
  const mentionReqId = useRef(0);
  const mentionDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMentions = useCallback(() => setMentionState(null), []);

  const syncMentionsNow = useCallback(async (value: string, caret: number) => {
    const query = mentionQueryAt(value, caret);
    if (!query || skillQueryOf(value) !== null) {
      closeMentions();
      return;
    }

    let groups = mentionCache.current.get(query.term);
    if (!groups) {
      const reqId = ++mentionReqId.current;
      try {
        const data = await listChatMentions(query.term);
        groups = data.groups;
        mentionCache.current.set(query.term, groups);
      } catch {
        groups = [];
      }
      if (reqId !== mentionReqId.current) return;
      const el = inputRef.current;
      const liveQuery = el ? mentionQueryAt(el.value, el.selectionStart ?? caret) : null;
      if (!liveQuery || liveQuery.term !== query.term) return;
    }

    if (!groups.length) {
      closeMentions();
      return;
    }

    const options = groups.flatMap((g) => g.options.map((o) => ({ ...o, kind: g.kind })));

    if (!options.length && query.term.includes(" ")) {
      closeMentions();
      return;
    }

    setMentionState({ query, groups, options, index: 0 });
  }, [closeMentions]);

  const scheduleMentionSync = useCallback((value: string, caret: number) => {
    if (mentionDebounceTimer.current) clearTimeout(mentionDebounceTimer.current);
    mentionDebounceTimer.current = setTimeout(() => void syncMentionsNow(value, caret), MENTION_DEBOUNCE_MS);
  }, [syncMentionsNow]);

  useEffect(() => () => {
    if (mentionDebounceTimer.current) clearTimeout(mentionDebounceTimer.current);
  }, []);

  const applyMention = (option: MentionRow) => {
    if (!mentionState) return;
    const { query } = mentionState;
    closeMentions();

    const token = `@${option.label}`;
    const tail = text.slice(query.end);
    const gap = /^\s/.test(tail) ? "" : " ";
    const nextValue = text.slice(0, query.start) + token + gap + tail;
    const caret = query.start + token.length + gap.length;

    setText(nextValue);
    setMentionTokens((prev) => [
      ...prev,
      { kind: option.kind, value: option.value, label: option.label, sublabel: option.sublabel, icon: option.icon, hint: option.hint, token },
    ]);

    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(caret, caret);
      inputRef.current?.focus();
    });
  };

  const collectMentions = (finalText: string): ChatMention[] => {
    const seen = new Set<string>();
    const out: ChatMention[] = [];
    for (const m of mentionTokens) {
      const key = `${m.kind} ${m.value}`;
      if (seen.has(key) || !finalText.includes(m.token)) continue;
      seen.add(key);
      out.push({ kind: m.kind, value: m.value, label: m.label, sublabel: m.sublabel, icon: m.icon, hint: m.hint });
    }
    return out;
  };

  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types || []).includes("Files");

  useEffect(() => {
    if (open) chat.refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.turns, chat.running]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const canSend = !!text.trim() || chat.attachments.some((a) => a.status === "ready");

  const submit = (value?: string) => {
    const toSend = (value ?? text).trim();
    if ((!toSend && !chat.attachments.some((a) => a.status === "ready")) || chat.running) return;
    const skill = value === undefined ? exactSkillSlug(toSend, chat.skills) : undefined;
    const mentions = value === undefined ? collectMentions(toSend) : [];
    setText("");
    setSkillDismissedFor(null);
    setMentionTokens([]);
    closeMentions();
    void chat.send(toSend, { skill, mentions });
  };

  const runSkill = (skill: ChatSkill) => {
    setText("");
    setSkillDismissedFor(null);
    setMentionTokens([]);
    closeMentions();
    void chat.send(`/${skill.slug}`, { skill: skill.slug });
  };

  const insertTrigger = (char: string) => {
    setPlusMenuOpen(false);
    setText((prev) => (prev && !prev.endsWith(" ") ? `${prev} ${char}` : `${prev}${char}`));
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const pickFiles = () => {
    setPlusMenuOpen(false);
    fileInputRef.current?.click();
  };

  const showWelcome = chat.turns.length === 0 && !chat.running && !chat.error;

  const lastUserIdx = chat.turns.reduce((acc, t, i) => (t.role === "user" ? i : acc), -1);
  // toolCalls.length > 0 matters here: an assistant turn with tool calls but
  // no text yet (still working, nothing written back) used to be filtered
  // out entirely, hiding the tool trail until text started streaming --
  // i.e. real-time tool progress never showed up in "real time" at all.
  const visibleTurns = groupAssistantTurns(
    chat.running
      ? chat.turns.filter((t, i) => i <= lastUserIdx || t.text.length > 0 || t.toolCalls.length > 0)
      : chat.turns,
  );
  const streamingNow = chat.running && visibleTurns.some((t) => t.partial && t.text.length > 0);
  // Not t.partial -- each tool-call sub-message settles (its own partial
  // flips false) the moment that one step finishes, well before the overall
  // exchange does, so after grouping the merged turn's partial flag just
  // reflects whichever sub-message merged in last. It goes false almost
  // immediately even while more steps are still running, which is why
  // gating on it here showed nothing at all during a real run. What
  // actually means "still going" is chat.running, checked against whether
  // this is the turn currently being built (the last one).
  const lastVisible = visibleTurns[visibleTurns.length - 1];
  const toolStatusShowing =
    chat.running && lastVisible?.role === "assistant" && lastVisible.toolCalls.length > 0;

  return (
    <div
      role="complementary"
      aria-label="Ask Alaiy"
      aria-hidden={!open}
      className={cn(
        "fixed inset-y-0 right-0 z-51 flex w-full border-l border-border bg-card text-sm text-foreground shadow-2xl transition-[transform,max-width] duration-200",
        // 400px is right for a chat column alone, but not for reading a file.
        // The drawer grows sideways instead of the file evicting the chat.
        fileOpen ? "max-w-[min(94vw,64rem)]" : "max-w-100",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      {/* Left of the chat, so the conversation stays pinned to the edge it
          has always occupied (and that the launcher opens from). */}
      {fileOpen && <AttachmentPreviewPane className="my-2 ml-2 min-w-0 flex-1" />}

      {/* grow-0 with shrink left on: the chat holds 400px while there is room
          and gives way only on a viewport too narrow for both. */}
      <div className="flex min-w-0 shrink basis-100 grow-0 flex-col">
      <div className="flex h-13 flex-none items-center gap-2 border-b border-border px-3">
        <button onClick={() => setPaletteOpen(true)} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13.5px] font-semibold hover:bg-accent hover:text-accent-foreground">
          <Sparkles className="size-4 text-primary" />
          Ask Alaiy
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
        <button onClick={onClose} aria-label="Close Ask Alaiy" className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          <X className="size-4" />
        </button>
      </div>

      {paletteOpen && (
        <HistoryPalette
          sessions={chat.sessions}
          sessionsLoading={chat.sessionsLoading}
          activeSessionId={chat.sessionId}
          onNewChat={() => { chat.newChat(); setPaletteOpen(false); }}
          onOpen={(name) => { void chat.load(name); setPaletteOpen(false); }}
          onDelete={(name) => void chat.remove(name)}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      <div
        ref={scrollRef}
        className={cn("flex-1 overflow-y-auto", dropping && "outline-2 -outline-offset-8 outline-dashed outline-primary")}
        onDragEnter={(e) => { if (!hasFiles(e)) return; e.preventDefault(); if (dragDepth.current++ === 0) setDropping(true); }}
        onDragOver={(e) => { if (hasFiles(e)) e.preventDefault(); }}
        onDragLeave={(e) => { if (!hasFiles(e)) return; if (--dragDepth.current <= 0) { dragDepth.current = 0; setDropping(false); } }}
        onDrop={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          dragDepth.current = 0;
          setDropping(false);
          chat.uploadFiles(e.dataTransfer.files);
        }}
      >
        {showWelcome ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <p className="font-heading text-lg font-semibold leading-tight">{greeting(userFullName, dayPart)}</p>
            <p className="mt-1 text-[13.5px] text-muted-foreground">How can I help?</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => submit(s)} className="rounded-full border border-border bg-card px-3 py-1.5 text-[12.5px] transition-colors hover:border-primary hover:bg-primary/5">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 py-4">
            {visibleTurns.map((turn, i) => {
              const isLast = i === visibleTurns.length - 1;
              return (
                <Turn
                  key={turn.key}
                  turn={turn}
                  showToolStatus={toolStatusShowing && isLast}
                  // Not turn.partial -- same reasoning as toolStatusShowing above:
                  // a sub-message can individually settle while the overall reply
                  // is still being built. A reply only counts as done once it's
                  // no longer the turn chat.running is actively generating.
                  settled={!(chat.running && isLast)}
                  sessionId={chat.sessionId}
                />
              );
            })}
            {!chat.running && chat.followUps.length > 0 && (
              <FollowUps items={chat.followUps} onPick={submit} />
            )}
            {chat.running && !streamingNow && !toolStatusShowing && <ThinkingIndicator />}
            {chat.error && <ErrorTurn text={chat.error} />}
          </div>
        )}
      </div>

      <div className="relative flex-none border-t border-border p-3">
        {mentionState ? (
          <MentionPicker groups={mentionState.groups} term={mentionState.query.term} activeIndex={mentionState.index} onPick={applyMention} />
        ) : skillsOpen && (
          <SkillPicker matches={skillMatches} activeIndex={skillIndex} allLoaded={chat.skills !== null} onPick={runSkill} />
        )}

        {chat.attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5" aria-live="polite">
            {chat.attachments.map((a) => (
              <AttachmentChip key={a.localId} attachment={a} onRemove={() => chat.removeAttachment(a.localId)} />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-lg border border-input bg-muted/40 px-3 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
          <div className="relative flex-none">
            <button type="button" onClick={() => setPlusMenuOpen((v) => !v)} aria-label="Add to message" aria-expanded={plusMenuOpen}
              className={cn("flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground", plusMenuOpen && "bg-accent text-accent-foreground")}>
              <Plus className="size-4" />
            </button>
            {plusMenuOpen && (
              <ComposerPlusMenu
                onMention={() => insertTrigger("@")}
                onSkill={() => insertTrigger("/")}
                onFiles={pickFiles}
                filesDisabled={chat.running || chat.attachments.length >= MAX_ATTACHMENTS}
                onClose={() => setPlusMenuOpen(false)}
              />
            )}
          </div>
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => { setText(e.target.value); scheduleMentionSync(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
            onClick={(e) => { const el = e.currentTarget; scheduleMentionSync(el.value, el.selectionStart ?? 0); }}
            onKeyUp={(e) => { if (!CARET_KEYS.includes(e.key)) return; const el = e.currentTarget; scheduleMentionSync(el.value, el.selectionStart ?? 0); }}
            onPaste={(e) => {
              const files = e.clipboardData.files;
              if (files.length) { e.preventDefault(); chat.uploadFiles(files); }
            }}
            onKeyDown={(e) => {
              if (mentionState) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  if (!mentionState.options.length) return;
                  const step = e.key === "ArrowDown" ? 1 : -1;
                  const count = mentionState.options.length;
                  setMentionState((s) => (s ? { ...s, index: (s.index + step + count) % count } : s));
                  return;
                }
                if (e.key === "Escape") { e.preventDefault(); closeMentions(); return; }
                if ((e.key === "Enter" || e.key === "Tab") && mentionState.options[mentionState.index]) {
                  e.preventDefault();
                  applyMention(mentionState.options[mentionState.index]);
                  return;
                }
              }
              if (skillsOpen) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  if (!skillMatches.length) return;
                  const step = e.key === "ArrowDown" ? 1 : -1;
                  setSkillIndex((i) => (i + step + skillMatches.length) % skillMatches.length);
                  return;
                }
                if (e.key === "Escape") { e.preventDefault(); setSkillDismissedFor(text); return; }
                if ((e.key === "Enter" || e.key === "Tab") && skillMatches[skillIndex]) {
                  e.preventDefault();
                  runSkill(skillMatches[skillIndex]);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="Ask anything…"
            className="max-h-40 flex-1 resize-none overflow-y-auto border-none bg-transparent text-[13.5px] leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <button onClick={() => submit()} disabled={!canSend || chat.running} aria-label="Send"
            className="flex size-8 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30">
            {chat.running ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          </button>
        </div>

        <input ref={fileInputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} hidden
          onChange={(e) => { chat.uploadFiles(e.target.files ?? []); e.target.value = ""; }} />

        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">Alaiy reads live business data. Check anything it changes.</p>
      </div>
      </div>
    </div>
  );
}

const REVEAL_WINDOW_MS = 420;
const REVEAL_MIN_CPS = 45;
const REVEAL_MAX_CPS = 250;
const REVEAL_SNAP_CHARS = 600;

function typedPrefix(text: string, shown: number): string {
  const prefix = text.slice(0, shown);
  const fences = prefix.match(/```/g);
  if (!fences || fences.length % 2 === 0) return prefix;
  return prefix.slice(0, prefix.lastIndexOf("```"));
}

/** The revealed prefix of a streaming message: a derived-rate character
 * reveal on top of the server's coarse ~400ms flush, so chunky polling reads
 * as smooth typing. See alaiy_os/chat/CHAT.md's Streaming section. */
export function useTypedText(text: string, partial: boolean): string {
  const target = useRef(text);
  target.current = text;
  const [shown, setShown] = useState(() => (!partial || text.length > REVEAL_SNAP_CHARS ? text.length : 0));
  const exact = useRef(shown);
  const streamed = useRef(partial);

  useEffect(() => {
    if (!partial && !streamed.current) {
      exact.current = target.current.length;
      setShown(target.current.length);
      return;
    }
    if (partial) streamed.current = true;

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const total = target.current.length;
      const backlog = total - exact.current;
      if (backlog > 0) {
        const cps = Math.min(REVEAL_MAX_CPS, Math.max(REVEAL_MIN_CPS, (backlog * 1000) / REVEAL_WINDOW_MS));
        exact.current = Math.min(total, exact.current + (cps * dt) / 1000);
        const whole = Math.floor(exact.current);
        setShown((prev) => (whole > prev ? whole : prev));
      } else if (!partial) {
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `text` matters here, not just `partial`: `groupAssistantTurns` merges a
    // tool-call message (often empty text) and its follow-up final-answer
    // message into one turn that keeps the same key, so the text this hook
    // reveals can jump to a completely different, longer string while
    // `partial` itself never flips. Without `text` in the deps, a loop that
    // already stopped (caught up to the old, shorter string while !partial)
    // never restarts to notice the swap, and the reveal freezes empty forever
    // -- exactly what showed up as a download-report reply with no text until
    // a reload remounted this hook from scratch.
  }, [partial, text]);

  return shown < text.length ? typedPrefix(text, shown) : text;
}

function Turn({
  turn, showToolStatus, settled, sessionId,
}: {
  turn: ThreadTurn;
  showToolStatus?: boolean;
  settled?: boolean;
  sessionId?: string | null;
}) {
  const typed = useTypedText(turn.text, turn.partial);

  if (turn.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {turn.attachments.length > 0 && (
          <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
            {turn.attachments.map((a, i) => <AttachmentChip key={i} attachment={a} />)}
          </div>
        )}
        {turn.text && (
          <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-3.5 py-2 text-[13.5px] leading-relaxed text-primary-foreground">
            {renderMentionedText(turn.text, turn.mentions)}
          </div>
        )}
      </div>
    );
  }

  // While only the tool-status line is showing (no answer text yet), it's a
  // single short line, not a paragraph -- center the avatar against it
  // instead of using the top-of-paragraph nudge meant for AnswerBody.
  const onlyStatusShowing = showToolStatus && turn.toolCalls.length > 0 && !typed;

  return (
    <div className={cn("flex gap-2.5", onlyStatusShowing && "items-center")}>
      <div
        className={cn(
          "flex size-6 flex-none items-center justify-center rounded-full bg-muted text-muted-foreground",
          !onlyStatusShowing && "mt-0.5",
        )}
      >
        <Sparkles className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed">
        {showToolStatus && turn.toolCalls.length > 0 && <ToolTrail turn={turn} withGap={!!typed} />}
        {typed && (
          <div className={typed.length < turn.text.length ? "ask-alaiy-streaming" : undefined}>
            <AnswerBody text={typed} />
          </div>
        )}
        {turn.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {turn.attachments.map((a, i) => <AttachmentChip key={i} attachment={a} />)}
          </div>
        )}
        {/* Every settled reply gets this, tool-using or not -- see
            feedback-control.tsx's own comment. */}
        {settled && sessionId && (
          <FeedbackControl
            session={sessionId}
            message={turn.key}
            screen="Interface Panel"
            agentTrail={{
              text: turn.text,
              tools: turn.toolCalls.map((call) => ({
                tool: call.name,
                input: call.input,
                failed: turn.toolErrors.has(call.id),
              })),
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * A single, continuously-replacing status line for whichever tool call is
 * most recent -- not a running history of every step. The caller only passes
 * showToolStatus=true for the turn currently being generated (not per-turn
 * `partial`, which settles per tool call well before the overall reply
 * does), and stops passing it once the whole exchange finishes, so nothing
 * "loading"-shaped lingers next to the finished answer.
 */
export function ToolTrail({ turn, withGap }: { turn: ThreadTurn; withGap?: boolean }) {
  const current = turn.toolCalls[turn.toolCalls.length - 1];
  if (!current) return null;
  const failed = turn.toolErrors.has(current.id);
  // The call can land before its own name does (the row is created, then
  // named), so an empty name isn't "no call" -- it's this one, mid-arrival.
  // Falling back to a generic label keeps the line something rather than a
  // bare pulsing dot with nothing next to it.
  const label = !current.name
    ? "Working…"
    : String(current.name).startsWith("skill:")
      ? `/${current.name.slice(6)}`
      : String(current.name).replace(/_/g, " ");

  return (
    // withGap only when answer text is about to render right below this --
    // a bottom margin here otherwise inflates this element's own box (it's
    // a flex item's only child, so the margin can't collapse out the way it
    // would in normal flow) to match the avatar's height, which leaves the
    // *visible* row sitting above true center even though the two flex
    // items end up technically equal height.
    <div className={cn("flex items-center gap-1.5 text-xs", withGap && "mb-2", failed ? "text-destructive" : "text-muted-foreground")}>
      <span className={cn("size-1.5 flex-none rounded-full", failed ? "bg-destructive" : "animate-pulse bg-border")} />
      <span className="font-medium capitalize">{label}</span>
      {failed && <span>· refused</span>}
    </div>
  );
}

const THINKING_WORDS = [
  "Thinking…", "Digging through the data…", "Crunching the numbers…",
  "Checking the ledgers…", "Piecing it together…", "Running the numbers…",
  "Reconciling…", "Working on it…",
];

function ThinkingIndicator() {
  const [i, setI] = useState(() => Math.floor(Math.random() * THINKING_WORDS.length));
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % THINKING_WORDS.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2.5">
      <div className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Sparkles className="size-3.5 animate-pulse" />
      </div>
      <span className="text-[13.5px] text-muted-foreground">{THINKING_WORDS[i]}</span>
    </div>
  );
}

/** Follow-up questions under the newest answer -- the welcome screen's chips,
 * kept alive past the first message.
 *
 * Anchored to the bottom of the thread rather than to the last assistant turn:
 * `groupAssistantTurns` merges a multi-step exchange into one object here but
 * not in every client, so "the last turn" is not a portable place to hang
 * these. The server only ever sends the newest set, so there is never a second
 * row of them further up.
 *
 * Left-aligned, unlike the welcome screen's centred row: these sit under an
 * answer rather than in the middle of an empty pane. */
function FollowUps({ items, onPick }: { items: string[]; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 pl-8.5">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-[12.5px] transition-colors hover:border-primary hover:bg-primary/5"
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function AttachmentChip({ attachment, onRemove }: { attachment: PendingAttachment | ChatAttachmentMeta; onRemove?: () => void }) {
  const status = "status" in attachment ? attachment.status : undefined;
  const errorText = "error" in attachment ? attachment.error : undefined;
  const fileUrl = "file_url" in attachment ? attachment.file_url : undefined;
  const isError = status === "error";
  const isArtifact = "kind" in attachment && attachment.kind === "artifact";
  const format = "format" in attachment ? attachment.format : undefined;

  const preview = useAttachmentPreview();
  // Only once the upload has a URL: a chip mid-read has nothing to show yet.
  const canPreview = Boolean(fileUrl && preview);

  const label = (
    <>
      {status === "uploading" ? (
        <Loader2 className="size-3.5 flex-none animate-spin text-muted-foreground" />
      ) : isArtifact ? (
        <FileIcon className="size-3.5 flex-none text-primary" />
      ) : (
        <FileIcon className={cn("size-3.5 flex-none", isError ? "text-destructive" : "text-muted-foreground")} />
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate">{attachment.file_name}</span>
        <span className={cn("block text-[10.5px]", isError ? "text-destructive" : "text-muted-foreground")}>
          {isError ? errorText : status === "uploading" ? "Reading…" : attachmentMeta(attachment.file_size, attachment.chars, format)}
        </span>
      </span>
    </>
  );

  return (
    <div
      className={cn(
        "flex max-w-55 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
        isError ? "border-destructive/30 bg-card text-destructive" : isArtifact ? "border-primary/30 bg-primary/4" : "border-border bg-muted/40",
        canPreview && "hover:border-primary",
      )}
    >
      {canPreview ? (
        <button
          type="button"
          onClick={() =>
            preview?.preview({
              file_name: attachment.file_name,
              file_url: fileUrl as string,
              file_size: attachment.file_size,
              format,
            })
          }
          title={`Preview ${attachment.file_name}`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {label}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">{label}</span>
      )}

      {/* Downloading is the one thing that has to work for every file type,
          including the ones the panel can't render -- so it is its own
          control rather than something you reach through the preview. */}
      {fileUrl && !onRemove && (
        <a
          href={fileUrl}
          download={attachment.file_name}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Download ${attachment.file_name}`}
          title={`Download ${attachment.file_name}`}
          className="flex-none rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Download className="size-3" />
        </a>
      )}

      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${attachment.file_name}`} className="flex-none rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

function SkillPicker({ matches, activeIndex, allLoaded, onPick }: { matches: ChatSkill[]; activeIndex: number; allLoaded: boolean; onPick: (skill: ChatSkill) => void }) {
  return (
    <div role="listbox" aria-label="Skills" className="absolute inset-x-3 bottom-full z-10 mb-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-md">
      {matches.length === 0 ? (
        <p className="px-3.5 py-2.5 text-[12.5px] text-muted-foreground">{allLoaded ? "No matching skill." : "This site has no skills set up."}</p>
      ) : (
        matches.map((skill, i) => (
          <button key={skill.slug} type="button" role="option" aria-selected={i === activeIndex}
            onMouseDown={(e) => { e.preventDefault(); onPick(skill); }}
            className={cn("block w-full border-b border-border px-3.5 py-2 text-left last:border-b-0", i === activeIndex ? "bg-accent" : "hover:bg-accent")}>
            <span className="text-[13px] font-semibold">/{skill.slug}</span>
            {skill.label && <span className="ml-2 text-[13px] text-muted-foreground">{skill.label}</span>}
            {skill.description && <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{skill.description}</span>}
          </button>
        ))
      )}
    </div>
  );
}

function MentionPicker({ groups, term, activeIndex, onPick }: { groups: MentionGroup[]; term: string; activeIndex: number; onPick: (option: MentionRow) => void }) {
  const total = groups.reduce((n, g) => n + g.options.length, 0);
  let flatIndex = -1;

  return (
    <div role="listbox" aria-label="Data points" className="absolute inset-x-3 bottom-full z-10 mb-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-md">
      {total === 0 ? (
        <p className="px-3.5 py-2.5 text-[12.5px] text-muted-foreground">{groups.some((g) => term.length < g.min_chars) ? "Keep typing to search." : "Nothing matches."}</p>
      ) : (
        groups.map((group) => group.options.length > 0 && (
          <div key={group.kind}>
            <p className="sticky top-0 z-1 bg-popover px-3.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{group.label}</p>
            {group.options.map((option) => {
              flatIndex += 1;
              const index = flatIndex;
              return (
                <button key={`${group.kind}:${option.value}`} type="button" role="option" aria-selected={index === activeIndex}
                  onMouseDown={(e) => { e.preventDefault(); onPick({ ...option, kind: group.kind }); }}
                  className={cn("flex w-full items-center gap-2.5 px-3.5 py-2 text-left", index === activeIndex ? "bg-accent" : "hover:bg-accent")}>
                  <MentionIcon name={option.icon} className="size-4 flex-none text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">{option.label}</span>
                    {option.sublabel && <span className="block truncate text-[11.5px] text-muted-foreground">{option.sublabel}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

function ErrorTurn({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-3.5" />
      </div>
      <p className="text-[13.5px] leading-relaxed text-destructive">{text}</p>
    </div>
  );
}

function HistoryPalette({
  sessions, sessionsLoading, activeSessionId, onNewChat, onOpen, onDelete, onClose,
}: {
  sessions: ChatSessionSummary[];
  sessionsLoading: boolean;
  activeSessionId: string | null;
  onNewChat: () => void;
  onOpen: (name: string) => void;
  onDelete: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const matching = q ? sessions.filter((s) => (s.title || "").toLowerCase().includes(q)) : sessions;

  const today = new Date().setHours(0, 0, 0, 0);
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const groups = new Map<string, ChatSessionSummary[]>();
  matching.forEach((s) => {
    const stamp = new Date(s.last_activity || s.modified).setHours(0, 0, 0, 0);
    const label = stamp >= today ? "Today" : stamp >= thisMonthStart ? "This month" : "Earlier";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(s);
  });
  const orderedGroups = (["Today", "This month", "Earlier"] as const).filter((label) => groups.has(label)).map((label) => [label, groups.get(label)!] as const);

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-start justify-center bg-black/25 pt-[12vh]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Ask Alaiy chats" onClick={(e) => e.stopPropagation()}
        className="flex max-h-[65vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
        <div className="flex flex-none items-center gap-2 border-b border-border px-3.5 py-3 text-muted-foreground focus-within:border-ring">
          <Search className="size-4 flex-none" />
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations…"
            className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground" />
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 hover:bg-accent hover:text-accent-foreground"><X className="size-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          <button onClick={onNewChat} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2.5 text-left text-[13.5px] font-medium hover:bg-accent">
            <Edit3 className="size-4 text-muted-foreground" /> New conversation
          </button>

          {!q && sessions.length === 0 && (
            <p className="px-2.5 py-6 text-center text-[12.5px] text-muted-foreground">{sessionsLoading ? "Loading…" : "Your chats will appear here."}</p>
          )}
          {q && matching.length === 0 && <p className="px-2.5 py-6 text-center text-[12.5px] text-muted-foreground">No chats match that.</p>}

          {orderedGroups.map(([label, rows]) => (
            <div key={label}>
              <p className="px-2.5 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              {rows.map((s) => (
                <div key={s.name} className="group relative flex items-center rounded-md hover:bg-accent">
                  <button onClick={() => onOpen(s.name)} className={cn("flex-1 truncate px-2.5 py-2.5 text-left text-[13.5px]", s.name === activeSessionId && "font-medium text-primary")}>
                    {s.title || "New chat"}
                    {s.status === "Running" && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary" title="Still answering" />}
                  </button>
                  <div className="relative flex-none pr-1.5">
                    <button onClick={(e) => { e.stopPropagation(); setMenuFor((cur) => (cur === s.name ? null : s.name)); }} aria-label="Chat options"
                      className="rounded-md p-1.5 text-muted-foreground opacity-0 hover:bg-card focus-visible:opacity-100 group-hover:opacity-100">
                      <MoreHorizontal className="size-3.5" />
                    </button>
                    {menuFor === s.name && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                        <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-md border border-border bg-popover shadow-md">
                          <button onClick={() => { setMenuFor(null); onDelete(s.name); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-destructive hover:bg-destructive/8">
                            <Trash2 className="size-3.5" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ComposerPlusMenu({ onMention, onSkill, onFiles, filesDisabled, onClose }: { onMention: () => void; onSkill: () => void; onFiles: () => void; filesDisabled: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-md">
        <PlusMenuItem icon={<Paperclip className="size-4" />} label="Attach files" disabled={filesDisabled} onClick={onFiles}
          title={filesDisabled ? `Up to ${MAX_ATTACHMENTS} files per message.` : undefined} />
        <div className="my-1 border-t border-border" />
        <PlusMenuItem icon={<AtSign className="size-4" />} label="Mention" shortcut="@" onClick={onMention} />
        <PlusMenuItem icon={<Slash className="size-4" />} label="Skills" shortcut="/" onClick={onSkill} />
      </div>
    </>
  );
}

function PlusMenuItem({ icon, label, shortcut, disabled, onClick, title }: { icon: ReactNode; label: string; shortcut?: string; disabled?: boolean; onClick?: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-50 disabled:hover:bg-transparent">
      <span className="flex-none text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <kbd className="flex-none rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">{shortcut}</kbd>}
    </button>
  );
}
