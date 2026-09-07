"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Alert, Spinner } from "@/components/ui";
import { Markdown } from "@/components/ask/markdown";
import type { ChatFeed, ChatMessage, ChatStatus } from "@/lib/backend/types";

/** How often to ask for more while a turn is being written. */
const POLL_MS = 900;

/**
 * A turn that never finishes has to stop being polled eventually. A worker can
 * die between claiming a session and setting it Idle, and without this the tab
 * asks forever and the composer stays locked with no way out.
 */
const MAX_POLL_MS = 4 * 60 * 1000;

/**
 * The conversation.
 *
 * ## Two compositions, one component
 *
 * An empty conversation on Home is not a chat with nothing in it — it is the
 * first screen of the product, so it is composed as one: the mark, the name,
 * Alaiy's read of the seller's own numbers, the prompt, and four questions
 * worth asking, centred in the viewport and lifted off it. The moment there is
 * something to read the composition inverts — transcript above, prompt docked
 * below — because from then on the answers are the screen and the prompt is
 * furniture. `centred` is that switch; nothing about the behaviour changes with
 * it.
 *
 * ## The cursor rule
 *
 * We poll with `partial=1`, so the feed includes the message the assistant is
 * still writing, re-sent longer each time. Core is explicit that this inverts
 * the normal rule: advancing the cursor to the highest seq seen would step
 * past the partial row and the finished message would never be sent again,
 * leaving a truncated answer on screen for good. So `cursor` only ever
 * advances past *complete* messages, and a partial is held separately and
 * redrawn rather than appended.
 *
 * ## Why the send is optimistic
 *
 * `send_message` returns when the turn is queued, and the user's own message
 * is not in the feed until the next poll — up to a second of the seller's
 * question having visibly vanished. So it is rendered locally and dropped the
 * moment the real row arrives, matched on seq.
 */
export function Chat({
  sessionId,
  greeting,
  suggestions,
  importing = false,
  variant,
  onSessionStarted,
}: {
  /** The chat to open, or null to start one on the first question. */
  sessionId: string | null;
  /** Alaiy's opening line, built on the server from this seller's figures. */
  greeting: string[];
  suggestions: string[];
  /** The first import is still running, so answers would be on partial data. */
  importing?: boolean;
  variant: "hero" | "panel";
  /** Told the id when a question creates a session, so a rail can add it. */
  onSessionStarted?: (id: string, title: string) => void;
}) {
  const pathname = usePathname();
  const hero = variant === "hero";

  // Initial only — see the note on keying below.
  const [session, setSession] = useState(sessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partial, setPartial] = useState<ChatMessage | null>(null);
  const [pending, setPending] = useState<{ seq: number; text: string } | null>(null);
  const [status, setStatus] = useState<ChatStatus>("Idle");
  const [chips, setChips] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");

  const cursor = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Switching chats replaces the conversation rather than appending to it, and
  // both callers key this component on the session id to make that happen.
  // Resetting the six pieces of state in an effect instead would be a
  // cascading render, and one that has to be kept in step with every new piece
  // of state added here — a remount cannot fall out of step.

  const absorb = useCallback((feed: ChatFeed) => {
    const complete = feed.messages.filter((m) => !m.partial);
    const writing = feed.messages.find((m) => m.partial) ?? null;

    if (complete.length) {
      setMessages((current) => {
        const seen = new Set(current.map((m) => m.seq));
        return [...current, ...complete.filter((m) => !seen.has(m.seq))];
      });
      // Past complete messages only — see the cursor rule above.
      cursor.current = Math.max(cursor.current, ...complete.map((m) => m.seq));
      // The optimistic copy has been superseded by the stored row.
      setPending((p) => (p && complete.some((m) => m.seq >= p.seq) ? null : p));
    }
    setPartial(writing);
    setStatus(feed.status);
    setChips(feed.suggestions ?? []);
    if (feed.error) setError(feed.error);
  }, []);

  const poll = useCallback(
    async (chat: string) => {
      const response = await fetch(
        `/api/chat/messages?session=${encodeURIComponent(chat)}&after=${cursor.current}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(String(response.status));
      absorb((await response.json()) as ChatFeed);
    },
    [absorb],
  );

  // Load the conversation, then keep polling while a turn is in flight.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const startedAt = Date.now();

    async function tick() {
      try {
        await poll(session!);
      } catch {
        // A blip must not look like a failed answer. The next tick retries,
        // and the turn is running on the server either way.
        if (!cancelled) setStatus("Running");
      }
    }

    tick();
    const timer = setInterval(() => {
      if (cancelled) return;
      if (Date.now() - startedAt > MAX_POLL_MS) {
        clearInterval(timer);
        setStatus("Idle");
        setError(
          "This answer is taking longer than it should. Reload to pick it back up, or ask again.",
        );
        return;
      }
      // Idle and nothing half-written means there is nothing to wait for.
      if (status !== "Running" && !partial && !sending) return;
      tick();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session, poll, status, partial, sending]);

  // Follow the answer as it is written, but only from near the bottom: a
  // seller who has scrolled up to read an earlier answer should stay there.
  // Measured on the scrolling element itself — measuring the content div
  // inside it always reads a distance of zero, which is "always scroll".
  useEffect(() => {
    const box = scroller.current;
    const node = bottom.current;
    if (!box || !node) return;
    const distance = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (distance < 200) node.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, partial, pending]);

  const busy = status === "Running" || sending || Boolean(partial);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy || importing) return;

    setDraft("");
    setError(null);
    setChips([]);
    setSending(true);
    // Seq is only for matching the stored row later; the server assigns the
    // real one. Anything above what we have seen works.
    setPending({ seq: cursor.current + 1, text: question });

    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session, text: question, screen: pathname }),
      });
      const body = await response.json();
      if (!response.ok) {
        setPending(null);
        setDraft(question);
        setError(typeof body.error === "string" ? body.error : "That didn't send.");
        return;
      }
      setStatus("Running");
      if (!session) {
        setSession(body.session);
        onSessionStarted?.(body.session, question.slice(0, 60));
      }
    } catch {
      setPending(null);
      setDraft(question);
      setError("We couldn't reach Alaiy. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  const empty = !messages.length && !partial && !pending;
  /** The first screen: everything in one centred block, prompt included. */
  const centred = hero && empty;

  // Built once and placed in whichever composition is on screen. The switch
  // happens on the first send, by which point the field is disabled and has
  // already lost focus — so there is nothing for a remount here to cost.
  const composer = (
    <Composer
      draft={draft}
      setDraft={setDraft}
      onSubmit={() => ask(draft)}
      busy={busy}
      importing={importing}
      hero={hero}
      lifted={centred}
    />
  );

  // Follow-ups once there is an answer; the standing suggestions before that.
  const offered = chips.length ? chips : empty ? suggestions : [];
  const prompts =
    !busy && !importing && offered.length ? (
      <Chips
        items={offered}
        onPick={ask}
        layout={centred ? "cards" : hero ? "pills" : "stack"}
        label={centred ? "Start with" : null}
      />
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={
            centred
              ? "mx-auto flex min-h-full w-full max-w-xl flex-col justify-center gap-7 px-5 py-10 sm:px-6"
              : hero
                ? "mx-auto w-full max-w-2xl space-y-5 px-5 py-7 sm:px-6"
                : "space-y-4 px-4 py-4"
          }
        >
          {centred ? (
            <>
              <Masthead greeting={greeting} />
              <div className="space-y-3">
                {composer}
                {prompts}
              </div>
              {error ? <Alert>{error}</Alert> : null}
            </>
          ) : (
            <>
              {empty ? <Opening greeting={greeting} /> : null}
              {messages.map((message) => (
                <Turn key={message.seq} message={message} hero={hero} />
              ))}
              {pending ? (
                <Bubble role="user" hero={hero}>
                  {pending.text}
                </Bubble>
              ) : null}
              {partial ? <Turn message={partial} hero={hero} /> : null}
              {status === "Running" && !partial ? <Thinking /> : null}
              {error ? <Alert>{error}</Alert> : null}
              <div ref={bottom} />
            </>
          )}
        </div>
      </div>

      {centred ? null : (
        <div
          className={`shrink-0 border-t border-line/70 ${
            hero ? "px-5 py-4 sm:px-6" : "px-4 py-3"
          }`}
        >
          <div className={hero ? "mx-auto w-full max-w-2xl space-y-2.5" : "space-y-2"}>
            {/* Follow-ups belong above the box, where they read as things to
                ask next rather than as a caption on what was just said. */}
            {prompts}
            {composer}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Alaiy's mark: a navy plate with the initial, square like everything else.
 *
 * Exported because the docked panel's header needs the same one, and two
 * copies of the product's own mark is how they end up different sizes.
 * `size` is in Tailwind's spacing steps, so 7 is h-7 w-7.
 */
export function Mark({ size = 7 }: { size?: 7 | 12 }) {
  const box = size === 12 ? "h-12 w-12 text-[16px]" : "h-7 w-7 text-[11px]";
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-sm bg-primary-600 font-sans font-bold text-white ${box}`}
    >
      A
    </span>
  );
}

/** The mark, the name and Alaiy's opening read — the first screen's header. */
function Masthead({ greeting }: { greeting: string[] }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Mark size={12} />
      <div className="space-y-3">
        <h1 className="text-display-lg">Ask Alaiy</h1>
        <div className="space-y-1.5">
          {greeting.map((line, index) => (
            // The opening line is the display face — it is Alaiy speaking, and
            // the one sentence on this screen that is read rather than scanned.
            // Everything after it is body copy.
            <p
              key={index}
              className={
                index === 0
                  ? "font-display text-quote text-ink"
                  : "text-[13.5px] leading-relaxed text-muted"
              }
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The same opening, as Alaiy's first message — the panel's empty state. */
function Opening({ greeting }: { greeting: string[] }) {
  return (
    <Row>
      <div className="space-y-1.5 rounded-sm border border-highlight-400 bg-highlight-100 px-3.5 py-3">
        {greeting.map((line, index) => (
          <p
            key={index}
            className={`text-[13px] leading-relaxed ${
              index === 0 ? "font-medium text-ink" : "text-muted"
            }`}
          >
            {line}
          </p>
        ))}
      </div>
    </Row>
  );
}

/**
 * An assistant turn, with the mark in its own gutter.
 *
 * The gutter is what keeps a tool trace, an answer and the thinking dots on
 * one left edge — so a turn that starts as dots and becomes an answer grows in
 * place rather than stepping sideways as each part appears.
 */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex animate-rise gap-2.5">
      <span className="mt-0.5">
        <Mark />
      </span>
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </div>
  );
}

/** One stored message: the tools it ran, then what it said. */
function Turn({ message, hero }: { message: ChatMessage; hero: boolean }) {
  if (message.role === "user") {
    return (
      <Bubble role="user" hero={hero}>
        {message.text}
      </Bubble>
    );
  }

  return (
    <Row>
      {message.tool_calls.length ? (
        <ToolTrace calls={message.tool_calls} errored={message.tool_errors} />
      ) : null}
      {message.text.trim() ? (
        <Bubble role="assistant" hero={hero}>
          <Markdown text={message.text} />
          {message.partial ? <Caret /> : null}
        </Bubble>
      ) : null}
    </Row>
  );
}

function Bubble({
  role,
  hero,
  children,
}: {
  role: "user" | "assistant";
  hero: boolean;
  children: React.ReactNode;
}) {
  const size = hero ? "text-[14px]" : "text-[13px]";

  if (role === "user") {
    // The seller's own words are the one navy panel on this screen — used
    // with intent, exactly as the system says, and it is what makes a
    // transcript readable as an exchange rather than as a column of cards.
    return (
      <div className="flex animate-rise justify-end">
        <div
          className={`max-w-[85%] whitespace-pre-wrap break-words rounded-sm bg-primary-600 px-4 py-2.5 leading-relaxed text-white ${size}`}
        >
          {children}
        </div>
      </div>
    );
  }

  // Alaiy's answer is a card on paper: white, one line, no blur.
  return (
    <div
      className={`break-words rounded-sm border border-line bg-white px-4 py-3 leading-relaxed text-ink ${size}`}
    >
      {children}
    </div>
  );
}

/**
 * What the assistant looked at.
 *
 * Shown rather than hidden because these answers are about the seller's own
 * money: "revenue was ₹4.3L" is worth more when it says it came from their
 * order lines. Core deliberately does not send tool *results* — they are raw
 * JSON the model has already summarised, and can be megabytes — so this is the
 * call, not its output.
 */
function ToolTrace({
  calls,
  errored,
}: {
  calls: ChatMessage["tool_calls"];
  errored: ChatMessage["tool_errors"];
}) {
  const failed = new Set(errored.filter(Boolean));
  return (
    <ul className="flex flex-wrap gap-1.5">
      {calls.map((call, n) => {
        const broke = call.id ? failed.has(call.id) : false;
        return (
          <li
            key={call.id ?? n}
            className={`inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-1 text-[11px] font-medium ${
              broke
                ? "border-alert/40 bg-alert-soft text-alert-ink"
                : "border-line bg-surface text-muted"
            }`}
            title={call.input ? JSON.stringify(call.input) : undefined}
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden
              className={`h-3 w-3 shrink-0 ${broke ? "text-alert" : "text-ok"}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={broke ? "M6 6l8 8M14 6l-8 8" : "M4.5 10.5l3.5 3.5 7.5-8"} />
            </svg>
            {LABELS[call.name ?? ""] ?? call.name}
            {broke ? " — failed" : ""}
          </li>
        );
      })}
    </ul>
  );
}

/** The scoped tools the backend supplies, in the seller's own words. */
const LABELS: Record<string, string> = {
  seller_metrics: "Read your headline figures",
  seller_aggregate: "Totalled your order lines",
  seller_orders: "Looked at your orders",
  seller_inventory: "Checked your inventory",
};

/** Mid-thought, in the gutter the answer will arrive in. */
function Thinking() {
  return (
    <Row>
      <div className="inline-flex items-center gap-2.5 rounded-sm border border-line bg-white px-3.5 py-2.5">
        <span aria-hidden className="flex items-center gap-1">
          {[0, 1, 2].map((n) => (
            <span
              key={n}
              className="h-1.5 w-1.5 animate-dot rounded-full bg-highlight-500"
              style={{ animationDelay: `${n * 0.16}s` }}
            />
          ))}
        </span>
        <span className="text-[12px] text-muted">Working through your data…</span>
      </div>
    </Row>
  );
}

/** Marks the end of text that is still arriving. */
function Caret() {
  return (
    <span
      aria-hidden
      className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-highlight-600"
    />
  );
}

/**
 * Questions worth asking next.
 *
 * Three shapes for three places: cards on the first screen, where they are half
 * the point of it and have room to be; pills under a transcript, where they are
 * an aside to an answer; and a stack in the docked panel, which is too narrow
 * for either.
 */
function Chips({
  items,
  onPick,
  layout,
  label,
}: {
  items: string[];
  onPick: (text: string) => void;
  layout: "cards" | "pills" | "stack";
  label: string | null;
}) {
  const shown = items.slice(0, 4);

  // A suggestion is a thing to press, so on the first screen — where they are
  // half the point of it — the cards borrow the press's own geometry: they lift
  // towards the reader and their shadow turns accent blue. Not the full button
  // shape, because a question is a sentence and sentences are not set in
  // letterspaced small caps.
  const styles = {
    cards:
      "group flex items-center justify-between gap-3 rounded-sm border border-line bg-white px-3.5 py-2.5 text-left text-[13px] text-primary-600 transition-[transform,box-shadow] duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-primary-600 hover:shadow-press-lift active:translate-x-1 active:translate-y-1 active:shadow-none",
    pills:
      "inline-flex items-center gap-1.5 rounded-xs border border-line bg-white px-3 py-1.5 text-left text-[12.5px] text-primary-600 transition-colors hover:border-primary-600 hover:bg-highlight-100",
    stack:
      "group flex w-full items-center justify-between gap-2 rounded-xs border border-line bg-white px-3 py-2 text-left text-[12.5px] text-primary-600 transition-colors hover:border-primary-600 hover:bg-highlight-100",
  };

  return (
    <div className="space-y-2">
      {label ? (
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500">
          {label}
        </p>
      ) : null}
      <div
        className={
          layout === "cards"
            ? "grid gap-2 sm:grid-cols-2"
            : layout === "pills"
              ? "flex flex-wrap gap-2"
              : "space-y-1.5"
        }
      >
        {shown.map((item) => (
          <button key={item} type="button" onClick={() => onPick(item)} className={styles[layout]}>
            <span className={layout === "pills" ? "" : "min-w-0"}>{item}</span>
            {layout === "pills" ? null : (
              <svg
                viewBox="0 0 20 20"
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 text-highlight-600 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 10h11M11 6l4 4-4 4" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function Composer({
  draft,
  setDraft,
  onSubmit,
  busy,
  importing,
  hero,
  lifted,
}: {
  draft: string;
  setDraft: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  importing: boolean;
  hero: boolean;
  /** On the first screen, where it is the one thing to do. */
  lifted: boolean;
}) {
  const disabled = busy || importing;
  const box = useRef<HTMLTextAreaElement>(null);

  // Grow with the question, to a point, then scroll. A one-line box that a
  // long question disappears into is the cheapest-feeling thing a composer
  // can do; `max-h-40` is where it stops taking the transcript's room.
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [draft]);

  return (
    <div className="space-y-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        // The pill carries the focus state, because the field inside it opts
        // out of the app's ring — see `.field-in-a-box` in globals.css.
        // On the first screen the box wears the press's own block shadow —
        // it is the one thing to do on that screen, and the shadow is what says
        // so. Docked under a transcript it is furniture, so it is just a card.
        className={`flex items-end gap-2 rounded-sm border-2 bg-white p-2 transition-[border-color,box-shadow] duration-100 focus-within:border-highlight-600 ${
          lifted ? "border-primary-600 shadow-press" : "border-line"
        }`}
      >
        <textarea
          ref={box}
          rows={1}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a newline. A question is usually one
            // line, and reaching for a send button every time is worse than
            // the occasional shifted newline.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          aria-label="Ask Alaiy a question"
          // Shorter in the docked panel: at 360px the long form wraps to a
          // second line the one-row box then clips.
          placeholder={
            importing
              ? "Importing your data…"
              : busy
                ? "Alaiy is answering…"
                : hero
                  ? "Ask Alaiy anything about your data…"
                  : "Ask about your data…"
          }
          className={`field-in-a-box max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-ink placeholder:text-muted-soft disabled:cursor-not-allowed ${
            hero ? "min-h-11 text-[15px]" : "min-h-10 text-sm"
          }`}
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          aria-label="Send"
          // The accent plate with navy on it — the system's one bright
          // control, and this is the action the whole screen is for.
          className={`grid shrink-0 place-items-center rounded-sm bg-highlight-300 text-primary-600 transition-colors hover:bg-highlight-400 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-soft ${
            hero ? "h-11 w-11" : "h-10 w-10"
          }`}
        >
          {busy ? (
            <Spinner />
          ) : (
            <svg
              viewBox="0 0 20 20"
              aria-hidden
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 10h11M11 6l4 4-4 4" />
            </svg>
          )}
        </button>
      </form>

      {importing ? (
        <p className={`text-[12px] text-muted ${lifted ? "text-center" : ""}`}>
          Still importing your data. Ask Alaiy opens once it has all landed.
        </p>
      ) : lifted ? (
        <p className="text-center text-[11px] text-muted-soft">
          Enter sends · Shift + Enter for a new line
        </p>
      ) : null}
    </div>
  );
}
