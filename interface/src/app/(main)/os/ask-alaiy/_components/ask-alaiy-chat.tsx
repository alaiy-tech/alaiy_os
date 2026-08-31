"use client";

import { useEffect, useRef, useState } from "react";

import { ArrowUp, Loader2, Mic, Paperclip, Sparkles, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AnswerBody } from "@/components/ask-alaiy/answer-body";
import "@/components/ask-alaiy/ask-alaiy.css";
import { useAskAlaiyContext } from "@/components/ask-alaiy/ask-alaiy-provider";
import { FeedbackControl } from "@/components/ask-alaiy/feedback-control";
import { ATTACHMENT_ACCEPT, AttachmentChip, ToolTrail, useTypedText } from "@/components/ask-alaiy/ask-alaiy-panel";
import { groupAssistantTurns, MAX_ATTACHMENTS, type ThreadTurn } from "@/hooks/use-ask-alaiy";

const PROMPT_IDEAS = [
  "Summarize this month's sales performance...",
  "Which products are running low on stock?",
  "Draft a follow-up email to a supplier...",
  "Compare revenue across regions this quarter...",
  "Find customers who haven't ordered in 60 days...",
];

const MODELS = ["Claude 3.5 Sonnet", "Claude 3.5 Haiku", "Claude 3 Opus"];

const TYPE_SPEED_MS = 35;
const DELETE_SPEED_MS = 18;
const HOLD_MS = 1600;
const PAUSE_MS = 400;

function useTypewriter(phrases: readonly string[]) {
  const [text, setText] = useState("");

  useEffect(() => {
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId: number;

    function tick() {
      const phrase = phrases[phraseIndex];

      if (!deleting) {
        charIndex++;
        setText(phrase.slice(0, charIndex));
        if (charIndex === phrase.length) {
          deleting = true;
          timeoutId = window.setTimeout(tick, HOLD_MS);
          return;
        }
        timeoutId = window.setTimeout(tick, TYPE_SPEED_MS);
      } else {
        charIndex--;
        setText(phrase.slice(0, charIndex));
        if (charIndex === 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          timeoutId = window.setTimeout(tick, PAUSE_MS);
          return;
        }
        timeoutId = window.setTimeout(tick, DELETE_SPEED_MS);
      }
    }

    timeoutId = window.setTimeout(tick, TYPE_SPEED_MS);
    return () => window.clearTimeout(timeoutId);
  }, [phrases]);

  return text;
}

function getGreeting(hour: number | null) {
  if (hour === null) return "Welcome";
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function AssistantAvatar({ centered }: { readonly centered?: boolean } = {}) {
  return (
    <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-full bg-muted", !centered && "mt-0.5")}>
      <Sparkles className="size-3.5 text-muted-foreground" />
    </div>
  );
}

function ChatBubble({
  turn, showToolStatus, settled, sessionId,
}: {
  readonly turn: ThreadTurn;
  readonly showToolStatus?: boolean;
  readonly settled?: boolean;
  readonly sessionId?: string | null;
}) {
  const typed = useTypedText(turn.text, turn.partial);

  if (turn.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {turn.attachments.length > 0 && (
          <div className="flex max-w-xl flex-wrap justify-end gap-1.5">
            {turn.attachments.map((a, i) => <AttachmentChip key={i} attachment={a} />)}
          </div>
        )}
        {turn.text && (
          <div className="max-w-xl whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground text-sm leading-relaxed">
            {turn.text}
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
    <div className={cn("flex justify-start gap-3", onlyStatusShowing && "items-center")}>
      <AssistantAvatar centered={onlyStatusShowing} />
      <div className="max-w-xl text-foreground text-sm leading-relaxed">
        {showToolStatus && turn.toolCalls.length > 0 && <ToolTrail turn={turn} withGap={!!typed} />}
        {typed && <AnswerBody text={typed} />}
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
            screen="Interface Page"
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

export function AskAlaiyChat({ userName }: { readonly userName: string }) {
  const chat = useAskAlaiyContext();
  const [input, setInput] = useState("");
  const [model, setModel] = useState(MODELS[0]);
  const endRef = useRef<HTMLDivElement>(null);
  const typewriterText = useTypewriter(PROMPT_IDEAS);
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);

  // The sticky composer's rendered height, not a guessed pb-* value -- a
  // fixed guess either clips the last message under the composer (too
  // small) or leaves a dead gap below it (too big, which is what was
  // happening at pb-28). Measured so it tracks the composer exactly,
  // including if its height ever changes (e.g. attachments row, wrapping).
  const composerRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types || []).includes("Files");
  const pickFiles = () => fileInputRef.current?.click();

  const lastUserIdx = chat.turns.reduce((acc, t, i) => (t.role === "user" ? i : acc), -1);
  // toolCalls.length > 0 matters here: an assistant turn with tool calls but
  // no text yet (still working) used to be filtered out entirely, hiding
  // real-time tool progress until text started streaming in. Grouped
  // afterwards because a multi-step reply arrives as several separate,
  // individually-settling messages (one per tool call) rather than one
  // growing row -- see groupAssistantTurns's own comment.
  const visibleTurns = groupAssistantTurns(
    chat.running
      ? chat.turns.filter((t, i) => i <= lastUserIdx || t.text.length > 0 || t.toolCalls.length > 0)
      : chat.turns,
  );
  const hasMessages = visibleTurns.length > 0;
  // Not t.partial -- each tool-call sub-message settles (its own partial
  // flips false) the moment that one step finishes, well before the overall
  // exchange does, so after grouping the merged turn's partial flag just
  // reflects whichever sub-message merged in last and goes false almost
  // immediately even while more steps are still running. What actually
  // means "still going" is chat.running, checked against whether this is
  // the turn currently being built (the last one).
  const lastVisible = visibleTurns[visibleTurns.length - 1];
  const toolStatusShowing =
    chat.running && lastVisible?.role === "assistant" && lastVisible.toolCalls.length > 0;
  const isThinking =
    chat.running && !toolStatusShowing && !visibleTurns.some((t) => t.partial && t.text.length > 0);

  // hasMessages is a dep because composerRef only attaches to a DOM node in
  // that branch (a different, unref'd wrapper renders the composer in the
  // empty/welcome state) -- without it, the ref becoming available for the
  // first time wouldn't otherwise retrigger this effect.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setComposerHeight(entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMessages]);

  // This page scrolls as a whole (see the overflow-x-clip note in
  // os/layout.tsx) rather than inside a bounded flex box, so "scroll to
  // bottom" means scrolling this sentinel into view, not an internal
  // container.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on new turns/thinking state to scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visibleTurns.length, chat.running]);

  const hasReadyAttachment = chat.attachments.some((a) => a.status === "ready");
  const canSend = !!input.trim() || hasReadyAttachment;

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !hasReadyAttachment) || chat.running) return;
    setInput("");
    void chat.send(trimmed);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  const placeholder = hasMessages ? "Message Ask Alaiy..." : typewriterText || "Ask Alaiy anything...";

  const composer = (
    <form onSubmit={handleSubmit} className="w-full">
      {chat.attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" aria-live="polite">
          {chat.attachments.map((a) => (
            <AttachmentChip key={a.localId} attachment={a} onRemove={() => chat.removeAttachment(a.localId)} />
          ))}
        </div>
      )}
      <InputGroup className="h-auto flex-col rounded-2xl bg-background p-1.5 shadow-sm">
        <InputGroupTextarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={(event) => {
            const files = event.clipboardData.files;
            if (files.length) {
              event.preventDefault();
              chat.uploadFiles(files);
            }
          }}
          placeholder={placeholder}
          className="min-h-11 px-2.5 py-2"
          rows={1}
        />
        <InputGroupAddon align="block-end" className="justify-between px-1 pb-1">
          <div className="flex items-center gap-1">
            <InputGroupButton
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Attach file"
              onClick={pickFiles}
              disabled={chat.running || chat.attachments.length >= MAX_ATTACHMENTS}
              title={chat.attachments.length >= MAX_ATTACHMENTS ? `Up to ${MAX_ATTACHMENTS} files per message.` : undefined}
            >
              <Paperclip />
            </InputGroupButton>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger size="sm" className="h-7 border-none bg-transparent px-2 shadow-none hover:bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {MODELS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <InputGroupButton type="button" variant="ghost" size="icon-sm" aria-label="Voice input">
              <Mic />
            </InputGroupButton>
            <Button
              type="submit"
              size="icon-sm"
              className="rounded-full"
              disabled={chat.running || !canSend}
              aria-label="Send message"
            >
              {chat.running ? <Loader2 className="animate-spin" /> : <ArrowUp />}
            </Button>
          </div>
        </InputGroupAddon>
      </InputGroup>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        hidden
        onChange={(event) => {
          chat.uploadFiles(event.target.files ?? []);
          event.target.value = "";
        }}
      />
    </form>
  );

  if (!hasMessages) {
    return (
      <div
        className={cn(
          "flex min-h-[70svh] flex-col items-center justify-center gap-8 px-4",
          dropping && "outline-2 -outline-offset-8 outline-dashed outline-primary",
        )}
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
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="font-semibold text-4xl tracking-tight">
            {getGreeting(hour)}, {userName}
          </h1>
          <p className="text-3xl tracking-tight">
            How Can I <span className="text-primary">Assist You Today?</span>
          </p>
        </div>

        <div className="w-full max-w-2xl">{composer}</div>
        {chat.error && (
          <p className="flex max-w-2xl items-center gap-1.5 text-center text-destructive text-sm">
            <TriangleAlert className="size-4 shrink-0" />
            {chat.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col",
        dropping && "outline-2 -outline-offset-8 outline-dashed outline-primary",
      )}
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
      {/* paddingBottom keeps the last message clear of the sticky composer
          below instead of scrolling right underneath it -- sized to the
          composer's actual measured height, not a guess. */}
      <div className="space-y-6 py-6" style={{ paddingBottom: composerHeight }}>
        {visibleTurns.map((turn, i) => {
          const isLast = i === visibleTurns.length - 1;
          return (
            <ChatBubble
              key={turn.key}
              turn={turn}
              showToolStatus={toolStatusShowing && isLast}
              // Not turn.partial -- same reasoning as toolStatusShowing: a
              // sub-message can individually settle while the overall reply
              // is still being built.
              settled={!(chat.running && isLast)}
              sessionId={chat.sessionId}
            />
          );
        })}

        {/* Follow-ups under the newest answer. Indented to the bubble text
            (size-6 avatar + gap-3), and anchored to the end of the thread
            rather than to the last turn -- groupAssistantTurns merges a
            multi-step exchange into one object, so "the last turn" is not a
            stable place to hang these. The server only ever sends the newest
            set, so no second row can appear further up. */}
        {!chat.running && chat.followUps.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-9">
            {chat.followUps.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => sendMessage(suggestion)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-[12.5px] transition-colors hover:border-primary hover:bg-primary/5"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {isThinking && (
          <div className="flex items-center gap-3">
            <AssistantAvatar />
            <div className="flex items-center gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}

        {chat.error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <TriangleAlert className="size-4 shrink-0" />
            {chat.error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div ref={composerRef} className="sticky bottom-0 z-10 bg-background pb-4 pt-2">
        {composer}
      </div>
    </div>
  );
}
