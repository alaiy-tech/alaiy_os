import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AtSign, Bot, Calendar, ChevronDown, Edit3, File as FileIcon, Loader2,
  MoreHorizontal, Package, Paperclip, Plus, Search, Send, Slash, Sparkles, Store, Tag,
  Trash2, TriangleAlert, X,
} from "lucide-react";
import { MAX_ATTACHMENTS, type useAskAlaiy, type PendingAttachment, type ThreadTurn } from "./useAskAlaiy";
import { listChatMentions } from "./chat";
import type {
  ChatAttachmentMeta, ChatMention, ChatSessionSummary, ChatSkill, MentionGroup, MentionOption,
} from "./chat";
import { AnswerBody } from "./AnswerBody";
import { FeedbackControl } from "./FeedbackControl";
import { cn } from "./utils";

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

// Mirrors alaiy_os/chat/attachments.py SUPPORTED -- a hint to the file picker
// only. The server re-checks: this attribute is trivially bypassed.
const ATTACHMENT_ACCEPT =
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
    tokens.includes(part) ? <span key={i} className="ask-alaiy-mention-token">{part}</span> : part,
  );
}

function MentionIcon({ name, size }: { name?: string | null; size: number }) {
  const icons: Record<string, typeof Tag> = { tag: Tag, calendar: Calendar, box: Package, store: Store };
  const Icon = (name && icons[name]) || AtSign;
  return <Icon size={size} />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function attachmentMeta(fileSize: number, chars?: number, format?: string): string {
  const size = formatFileSize(fileSize);
  if (format) return `${format.toUpperCase()} · ${size}`;
  return chars ? `${size} · ${chars.toLocaleString("en-IN")} characters read` : size;
}

function greeting(fullName: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = fullName.split(" ")[0] || fullName;
  return `${part}, ${first}`;
}

export function AskAlaiyPanel({
  open, onClose, chat,
}: {
  open: boolean;
  onClose: () => void;
  chat: ReturnType<typeof useAskAlaiy>;
}) {
  const [text, setText] = useState("");
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
  const visibleTurns = chat.running
    ? chat.turns.filter((t, i) => i <= lastUserIdx || t.text.length > 0)
    : chat.turns;
  const streamingNow = chat.running && visibleTurns.some((t) => t.partial && t.text.length > 0);

  return (
    <div className={cn("ask-alaiy-panel", open && "is-open")} role="complementary" aria-label="Ask Alaiy" aria-hidden={!open}>
      <div className="ask-alaiy-panel-header">
        <button onClick={() => setPaletteOpen(true)} className="ask-alaiy-panel-title-btn">
          <Sparkles size={16} className="ask-alaiy-accent" />
          Ask Alaiy
          <ChevronDown size={14} />
        </button>
        <button onClick={onClose} aria-label="Close Ask Alaiy" className="ask-alaiy-icon-btn">
          <X size={16} />
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
        className={cn("ask-alaiy-body", dropping && "is-dropping")}
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
          <div className="ask-alaiy-welcome">
            <div className="ask-alaiy-welcome-icon"><Bot size={20} /></div>
            <p className="ask-alaiy-welcome-title">{greeting(frappe.fullname(frappe.session.user) || frappe.session.user)}</p>
            <p className="ask-alaiy-welcome-sub">How can I help?</p>
            <div className="ask-alaiy-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => submit(s)} className="ask-alaiy-suggestion-chip">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="ask-alaiy-thread">
            {visibleTurns.map((turn, i) => {
              const isLast = i === visibleTurns.length - 1;
              return (
                <Turn
                  key={turn.key}
                  turn={turn}
                  suppressTools={chat.running}
                  // Only gate the turn currently being generated -- an
                  // older, already-finished turn stays feedback-able even
                  // while a newer message is running.
                  settled={!(chat.running && isLast)}
                  sessionId={chat.sessionId}
                />
              );
            })}
            {chat.running && !streamingNow && <ThinkingIndicator />}
            {chat.error && <ErrorTurn text={chat.error} />}
          </div>
        )}
      </div>

      <div className="ask-alaiy-composer-wrap">
        {mentionState ? (
          <MentionPicker groups={mentionState.groups} term={mentionState.query.term} activeIndex={mentionState.index} onPick={applyMention} />
        ) : skillsOpen && (
          <SkillPicker matches={skillMatches} activeIndex={skillIndex} allLoaded={chat.skills !== null} onPick={runSkill} />
        )}

        {chat.attachments.length > 0 && (
          <div className="ask-alaiy-attachment-tray" aria-live="polite">
            {chat.attachments.map((a) => (
              <AttachmentChip key={a.localId} attachment={a} onRemove={() => chat.removeAttachment(a.localId)} />
            ))}
          </div>
        )}

        <div className="ask-alaiy-composer">
          <div className="ask-alaiy-plus-wrap">
            <button type="button" onClick={() => setPlusMenuOpen((v) => !v)} aria-label="Add to message" aria-expanded={plusMenuOpen} className={cn("ask-alaiy-icon-btn", plusMenuOpen && "is-active")}>
              <Plus size={16} />
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
            className="ask-alaiy-input"
          />
          <button onClick={() => submit()} disabled={!canSend || chat.running} aria-label="Send" className="ask-alaiy-send-btn">
            {chat.running ? <Loader2 size={14} className="ask-alaiy-spin" /> : <Send size={13} />}
          </button>
        </div>

        <input ref={fileInputRef} type="file" multiple accept={ATTACHMENT_ACCEPT} hidden
          onChange={(e) => { chat.uploadFiles(e.target.files ?? []); e.target.value = ""; }} />

        <p className="ask-alaiy-disclaimer">Alaiy reads live business data. Check anything it changes.</p>
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
 * as smooth typing. See alaiy_os/chat/CHAT.md's Streaming section for what
 * it's layered on top of. */
function useTypedText(text: string, partial: boolean): string {
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
  }, [partial]);

  return shown < text.length ? typedPrefix(text, shown) : text;
}

function Turn({
  turn, suppressTools, settled, sessionId,
}: {
  turn: ThreadTurn;
  suppressTools?: boolean;
  settled?: boolean;
  sessionId?: string | null;
}) {
  const typed = useTypedText(turn.text, turn.partial);

  if (turn.role === "user") {
    return (
      <div className="ask-alaiy-turn ask-alaiy-turn-user">
        {turn.attachments.length > 0 && (
          <div className="ask-alaiy-turn-attachments">
            {turn.attachments.map((a, i) => <AttachmentChip key={i} attachment={a} />)}
          </div>
        )}
        {turn.text && <div className="ask-alaiy-bubble">{renderMentionedText(turn.text, turn.mentions)}</div>}
      </div>
    );
  }

  return (
    <div className="ask-alaiy-turn ask-alaiy-turn-assistant">
      <div className="ask-alaiy-avatar"><Sparkles size={13} /></div>
      <div className="ask-alaiy-turn-content">
        {turn.toolCalls.length > 0 && !suppressTools && <ToolTrail turn={turn} />}
        {typed && (
          <div className={typed.length < turn.text.length ? "ask-alaiy-streaming" : undefined}>
            <AnswerBody text={typed} />
          </div>
        )}
        {turn.attachments.length > 0 && (
          <div className="ask-alaiy-turn-attachments ask-alaiy-turn-attachments-below">
            {turn.attachments.map((a, i) => <AttachmentChip key={i} attachment={a} />)}
          </div>
        )}
        {/* Every settled reply gets this, tool-using or not -- see
            FeedbackControl.tsx's own comment. */}
        {settled && sessionId && (
          <FeedbackControl
            session={sessionId}
            message={turn.key}
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

function ToolTrail({ turn }: { turn: ThreadTurn }) {
  return (
    <div className="ask-alaiy-tool-trail">
      {turn.toolCalls.map((call) => {
        const failed = turn.toolErrors.has(call.id);
        const args = Object.entries(call.input || {}).filter(([, v]) => v !== null && v !== "");
        return (
          <details key={call.id}>
            <summary className={cn("ask-alaiy-tool-summary", failed && "is-failed")}>
              <span className={cn("ask-alaiy-tool-dot", failed && "is-failed")} />
              <span className="ask-alaiy-tool-name">
                {String(call.name || "").startsWith("skill:") ? `/${call.name.slice(6)}` : String(call.name || "").replace(/_/g, " ")}
              </span>
              {failed && <span>· refused</span>}
            </summary>
            {args.length > 0 && (
              <dl className="ask-alaiy-tool-args">
                {args.map(([k, v]) => (
                  <div key={k} className="ask-alaiy-tool-arg-row">
                    <dt>{k}</dt>
                    <dd>{typeof v === "string" ? v : JSON.stringify(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </details>
        );
      })}
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
    <div className="ask-alaiy-thinking">
      <div className="ask-alaiy-avatar"><Sparkles size={13} className="ask-alaiy-pulse" /></div>
      <span>{THINKING_WORDS[i]}</span>
    </div>
  );
}

function AttachmentChip({ attachment, onRemove }: { attachment: PendingAttachment | ChatAttachmentMeta; onRemove?: () => void }) {
  const status = "status" in attachment ? attachment.status : undefined;
  const errorText = "error" in attachment ? attachment.error : undefined;
  const fileUrl = "file_url" in attachment ? attachment.file_url : undefined;
  const isError = status === "error";
  const isArtifact = "kind" in attachment && attachment.kind === "artifact";
  const format = "format" in attachment ? attachment.format : undefined;

  const body = (
    <>
      {status === "uploading" ? (
        <Loader2 size={14} className="ask-alaiy-spin" />
      ) : isArtifact ? (
        <FileIcon size={14} className="ask-alaiy-accent" />
      ) : (
        <FileIcon size={14} className={isError ? "ask-alaiy-bad" : undefined} />
      )}
      <span className="ask-alaiy-chip-text">
        <span className="ask-alaiy-chip-name">{attachment.file_name}</span>
        <span className={cn("ask-alaiy-chip-meta", isError && "is-error")}>
          {isError ? errorText : status === "uploading" ? "Reading…" : attachmentMeta(attachment.file_size, attachment.chars, format)}
        </span>
      </span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${attachment.file_name}`} className="ask-alaiy-chip-remove">
          <X size={11} />
        </button>
      )}
    </>
  );

  const className = cn("ask-alaiy-chip", isError && "is-error", isArtifact && "is-artifact");

  if (fileUrl && !onRemove) {
    return (
      <a href={fileUrl} {...(isArtifact ? { download: attachment.file_name } : { target: "_blank", rel: "noopener noreferrer" })} className={className}>
        {body}
      </a>
    );
  }
  return <div className={className}>{body}</div>;
}

function SkillPicker({ matches, activeIndex, allLoaded, onPick }: { matches: ChatSkill[]; activeIndex: number; allLoaded: boolean; onPick: (skill: ChatSkill) => void }) {
  return (
    <div role="listbox" aria-label="Skills" className="ask-alaiy-picker">
      {matches.length === 0 ? (
        <p className="ask-alaiy-picker-empty">{allLoaded ? "No matching skill." : "This site has no skills set up."}</p>
      ) : (
        matches.map((skill, i) => (
          <button key={skill.slug} type="button" role="option" aria-selected={i === activeIndex}
            onMouseDown={(e) => { e.preventDefault(); onPick(skill); }}
            className={cn("ask-alaiy-picker-row", i === activeIndex && "is-active")}>
            <span className="ask-alaiy-picker-title">/{skill.slug}</span>
            {skill.label && <span className="ask-alaiy-picker-sub">{skill.label}</span>}
            {skill.description && <span className="ask-alaiy-picker-desc">{skill.description}</span>}
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
    <div role="listbox" aria-label="Data points" className="ask-alaiy-picker">
      {total === 0 ? (
        <p className="ask-alaiy-picker-empty">{groups.some((g) => term.length < g.min_chars) ? "Keep typing to search." : "Nothing matches."}</p>
      ) : (
        groups.map((group) => group.options.length > 0 && (
          <div key={group.kind}>
            <p className="ask-alaiy-picker-group-label">{group.label}</p>
            {group.options.map((option) => {
              flatIndex += 1;
              const index = flatIndex;
              return (
                <button key={`${group.kind}:${option.value}`} type="button" role="option" aria-selected={index === activeIndex}
                  onMouseDown={(e) => { e.preventDefault(); onPick({ ...option, kind: group.kind }); }}
                  className={cn("ask-alaiy-picker-row ask-alaiy-picker-row-mention", index === activeIndex && "is-active")}>
                  <MentionIcon name={option.icon} size={15} />
                  <span>
                    <span className="ask-alaiy-picker-title">{option.label}</span>
                    {option.sublabel && <span className="ask-alaiy-picker-sub-block">{option.sublabel}</span>}
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
    <div className="ask-alaiy-error-turn">
      <div className="ask-alaiy-avatar ask-alaiy-avatar-bad"><TriangleAlert size={13} /></div>
      <p>{text}</p>
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
    <div className="ask-alaiy-palette-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Ask Alaiy chats" onClick={(e) => e.stopPropagation()} className="ask-alaiy-palette">
        <div className="ask-alaiy-palette-search">
          <Search size={15} />
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations…" />
          <button onClick={onClose} aria-label="Close" className="ask-alaiy-icon-btn"><X size={15} /></button>
        </div>

        <div className="ask-alaiy-palette-list">
          <button onClick={onNewChat} className="ask-alaiy-palette-new">
            <Edit3 size={15} /> New conversation
          </button>

          {!q && sessions.length === 0 && (
            <p className="ask-alaiy-palette-empty">{sessionsLoading ? "Loading…" : "Your chats will appear here."}</p>
          )}
          {q && matching.length === 0 && <p className="ask-alaiy-palette-empty">No chats match that.</p>}

          {orderedGroups.map(([label, rows]) => (
            <div key={label}>
              <p className="ask-alaiy-palette-group-label">{label}</p>
              {rows.map((s) => (
                <div key={s.name} className="ask-alaiy-palette-row">
                  <button onClick={() => onOpen(s.name)} className={cn("ask-alaiy-palette-row-btn", s.name === activeSessionId && "is-active")}>
                    {s.title || "New chat"}
                    {s.status === "Running" && <span className="ask-alaiy-running-dot" title="Still answering" />}
                  </button>
                  <div className="ask-alaiy-palette-menu-wrap">
                    <button onClick={(e) => { e.stopPropagation(); setMenuFor((cur) => (cur === s.name ? null : s.name)); }} aria-label="Chat options" className="ask-alaiy-icon-btn">
                      <MoreHorizontal size={14} />
                    </button>
                    {menuFor === s.name && (
                      <>
                        <div className="ask-alaiy-menu-scrim" onClick={() => setMenuFor(null)} />
                        <div className="ask-alaiy-dropdown">
                          <button onClick={() => { setMenuFor(null); onDelete(s.name); }} className="ask-alaiy-dropdown-item is-bad">
                            <Trash2 size={14} /> Delete
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
      <div className="ask-alaiy-menu-scrim" onClick={onClose} />
      <div className="ask-alaiy-dropdown ask-alaiy-plus-menu">
        <PlusMenuItem icon={<Paperclip size={15} />} label="Attach files" disabled={filesDisabled} onClick={onFiles}
          title={filesDisabled ? `Up to ${MAX_ATTACHMENTS} files per message.` : undefined} />
        <div className="ask-alaiy-menu-divider" />
        <PlusMenuItem icon={<AtSign size={15} />} label="Mention" shortcut="@" onClick={onMention} />
        <PlusMenuItem icon={<Slash size={15} />} label="Skills" shortcut="/" onClick={onSkill} />
      </div>
    </>
  );
}

function PlusMenuItem({ icon, label, shortcut, disabled, onClick, title }: { icon: ReactNode; label: string; shortcut?: string; disabled?: boolean; onClick?: () => void; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className="ask-alaiy-dropdown-item">
      <span className="ask-alaiy-dropdown-icon">{icon}</span>
      <span className="ask-alaiy-dropdown-label">{label}</span>
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
}
