import type {
  ChatFeed,
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
} from "@/lib/backend/types";
import { DEMO_CURRENCY, stamp, world } from "@/lib/dev/demo-seed";

/**
 * Ask Alaiy, without an Ask Alaiy.
 *
 * The composer is the one part of the shell that is a conversation rather than
 * a render: it posts a question, then polls `get_messages` until an answer
 * finishes arriving. A stub that returned the whole reply on the first poll
 * would leave the two states the panel actually has to render — "thinking" and
 * "still writing" — impossible to look at. So this answers on a clock: the
 * question lands immediately, the reply is `partial` for a couple of seconds
 * while it fills in, and only then is it committed.
 *
 * State is module-level, which is exactly as durable as it needs to be. A dev
 * server restart forgets every chat, and that is the correct amount of memory
 * for fabricated conversation.
 */

type DemoChat = {
  name: string;
  title: string | null;
  messages: ChatMessage[];
  /** The reply being written, if any. Committed by the poll that outlives it. */
  pending?: { seq: number; answer: string; startedAt: number; creation: string };
  modified: string;
};

const chats = new Map<string, DemoChat>();
let counter = 0;

const MODEL = "claude-opus-5";

/** How long a reply takes to "write". Long enough to see the partial state. */
const WRITE_MS = 2600;

function summarise(chat: DemoChat): ChatSessionSummary {
  const last = chat.messages[chat.messages.length - 1];
  return {
    name: chat.name,
    title: chat.title,
    model: MODEL,
    status: chat.pending ? "Running" : "Idle",
    last_activity: last?.creation ?? chat.modified,
    modified: chat.modified,
  };
}

function message(
  chat: DemoChat,
  role: ChatMessage["role"],
  text: string,
  partial = false,
  seq?: number,
  creation?: string,
): ChatMessage {
  return {
    name: `${chat.name}-${seq ?? chat.messages.length + 1}`,
    seq: seq ?? chat.messages.length + 1,
    role,
    text,
    attachments: [],
    mentions: [],
    skill: null,
    tool_calls: [],
    tool_errors: [],
    partial,
    creation: creation ?? stamp(new Date()),
  };
}

/**
 * What the demo assistant says.
 *
 * Answers are drawn from the same fabricated world the tabs render, so asking
 * about unshipped orders and then opening the Orders tab gives you the same
 * number. Anything it has no reading for gets an honest refusal rather than an
 * invented figure — this mode exists to check a UI, and a stub that made up
 * plausible answers would be the one part of it that could mislead.
 */
function answerFor(question: string): string {
  const { orders, stockRows } = world();
  const asked = question.toLowerCase();

  const money = (value: number) =>
    `${DEMO_CURRENCY} ${Math.round(value).toLocaleString("en-IN")}`;

  if (/(unshipped|not shipped|stuck|late)/.test(asked)) {
    // Oldest first: `orders` is newest-first, and "the oldest is" reading off
    // the head of that list would name the most recent one.
    const stuck = orders
      .filter((order) => order.flags.includes("stuck"))
      .sort((a, b) => b.ageHours - a.ageHours);
    return (
      `**${stuck.length} orders** are past your unshipped threshold right now — ` +
      `${stuck.filter((o) => o.channel === "amazon").length} on Amazon and ` +
      `${stuck.filter((o) => o.channel === "shopify").length} on Shopify.\n\n` +
      `The oldest is ${stuck[0]?.order_number ?? "—"}, placed ` +
      `${Math.round((stuck[0]?.ageHours ?? 0) / 24)} days ago. Open the Orders tab ` +
      `with the "Not shipped" filter to work through them.`
    );
  }

  if (/(stock|inventory|run out|reorder|cover)/.test(asked)) {
    const critical = stockRows
      .filter((row) => row.band === "critical" || row.band === "low")
      .slice(0, 4);
    return (
      `**${critical.length} listings** are inside two weeks of cover:\n\n` +
      critical
        .map(
          (row) =>
            `- ${row.brand_sku} — ${row.name} · ${row.days_of_cover ?? "—"} days left on ${row.channel}`,
        )
        .join("\n") +
      `\n\nPO-2423 covers the brass diyas and lands in four days. Nothing is on order for the seagrass baskets.`
    );
  }

  if (/(sales|revenue|gmv|selling|today)/.test(asked)) {
    const week = orders.filter((order) => order.ageHours <= 24 * 7);
    const gmv = week.reduce((sum, order) => sum + (order.merchandise_total ?? 0), 0);
    return (
      `Over the last 7 days you took **${week.length} orders** worth ` +
      `**${money(gmv)}** in merchandise value.\n\n` +
      `Amazon is ${Math.round((week.filter((o) => o.channel === "amazon").length / Math.max(week.length, 1)) * 100)}% ` +
      `of that by order count. The Dashboard tiles compare this against the 7 days before it.`
    );
  }

  if (/(refund|return|cancel)/.test(asked)) {
    const refunded = orders.filter((order) => order.flags.includes("refunded"));
    const cancelled = orders.filter((order) => order.flags.includes("cancelled"));
    return (
      `In the last 45 days: **${refunded.length} refunded** and **${cancelled.length} cancelled** orders.\n\n` +
      `Neither channel gives us RMA returns, so the return-rate tile on the Dashboard ` +
      `is those two together — it says so on the tile rather than claiming to be a real return rate.`
    );
  }

  return (
    `This is demo mode, so I'm reading the same fabricated workspace the tabs are — ` +
    `I can answer about **orders**, **stock cover**, **sales** and **refunds** from it.\n\n` +
    `Anything else I'd have to invent, which would make this screen the one part of ` +
    `demo mode you couldn't trust. Ask me one of those, or switch off \`ALAIY_DEMO\` ` +
    `and point the app at a real backend.`
  );
}

export function createSession(title?: string): ChatSession {
  counter += 1;
  const name = `demo-chat-${counter}`;
  const chat: DemoChat = {
    name,
    title: title?.slice(0, 60) ?? null,
    messages: [],
    modified: stamp(new Date()),
  };
  chats.set(name, chat);
  return { session: name, title: chat.title, model: MODEL, status: "Idle" };
}

export function listSessions(limit = 30): ChatSessionSummary[] {
  return [...chats.values()]
    .map(summarise)
    .sort((a, b) => b.modified.localeCompare(a.modified))
    .slice(0, limit);
}

export function deleteSession(name: string): void {
  chats.delete(name);
}

export function sendMessage(
  name: string,
  text: string,
): { seq: number; status: string } {
  const chat = chats.get(name);
  if (!chat) return { seq: 0, status: "Error" };

  const seq = chat.messages.length + 1;
  chat.messages.push(message(chat, "user", text, false, seq));
  chat.title ??= text.slice(0, 60);
  chat.modified = stamp(new Date());
  chat.pending = {
    seq: seq + 1,
    answer: answerFor(text),
    startedAt: Date.now(),
    creation: stamp(new Date()),
  };
  return { seq, status: "Running" };
}

/**
 * The poll.
 *
 * `after` is a cursor over *complete* messages only — the panel is explicit
 * that advancing past a partial row would mean never being sent the finished
 * one — so the reply in flight is re-sent in full on every poll until it is
 * committed, exactly as core does it.
 */
export function getMessages(name: string, after = 0, partial = true): ChatFeed {
  const chat = chats.get(name);
  if (!chat) {
    return {
      session: name,
      title: null,
      status: "Error",
      error: "That chat no longer exists.",
      messages: [],
      suggestions: [],
    };
  }

  // Commit the reply if it has had long enough to be written. Done on read
  // rather than on a timer: there is no scheduler in a request/response server,
  // and the poll is the only thing that reliably happens.
  if (chat.pending && Date.now() - chat.pending.startedAt >= WRITE_MS) {
    const { seq, answer, creation } = chat.pending;
    chat.messages.push(message(chat, "assistant", answer, false, seq, creation));
    chat.pending = undefined;
    chat.modified = stamp(new Date());
  }

  const messages = chat.messages.filter((row) => row.seq > after);

  if (chat.pending && partial) {
    // A share of the answer proportional to how long it has been writing, cut
    // on a word boundary so the panel never renders half a word.
    const progress = (Date.now() - chat.pending.startedAt) / WRITE_MS;
    const upto = Math.max(1, Math.floor(chat.pending.answer.length * progress));
    const text = chat.pending.answer.slice(0, upto).replace(/\S*$/, "");
    messages.push(
      message(chat, "assistant", text, true, chat.pending.seq, chat.pending.creation),
    );
  }

  return {
    session: chat.name,
    title: chat.title,
    status: chat.pending ? "Running" : "Idle",
    error: null,
    messages,
    suggestions: chat.pending
      ? []
      : [
          "Which orders are past their ship-by date?",
          "What am I about to run out of?",
          "How did the last 7 days compare?",
        ],
  };
}
