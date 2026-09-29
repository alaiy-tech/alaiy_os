import type {
  ChatFeed,
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
  ChatToolCall,
} from "@/lib/backend/types";
import { DEMO_CURRENCY, stamp, world } from "@/lib/dev/demo-seed";
import { VENDOR_SHEET_MARKER, evaluateVendorRows, type VendorRow } from "@/lib/dev/vendor-sheet";

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
  pending?: {
    seq: number;
    answer: string;
    tools: ChatToolCall[];
    startedAt: number;
    creation: string;
  };
  modified: string;
};

function toolCall(name: string, input: unknown = {}): ChatToolCall {
  return { id: `${name}-${Math.random().toString(36).slice(2, 8)}`, name, input };
}

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
  tools: ChatToolCall[] = [],
): ChatMessage {
  return {
    name: `${chat.name}-${seq ?? chat.messages.length + 1}`,
    seq: seq ?? chat.messages.length + 1,
    role,
    text,
    attachments: [],
    mentions: [],
    skill: null,
    tool_calls: tools,
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
function answerFor(question: string): { text: string; tools: ChatToolCall[] } {
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
    return {
      tools: [toolCall("seller_orders")],
      text:
        `**${stuck.length} orders** are past your unshipped threshold right now — ` +
        `${stuck.filter((o) => o.channel === "amazon").length} on Amazon and ` +
        `${stuck.filter((o) => o.channel === "shopify").length} on Shopify.\n\n` +
        `The oldest is ${stuck[0]?.order_number ?? "—"}, placed ` +
        `${Math.round((stuck[0]?.ageHours ?? 0) / 24)} days ago. Open the Orders tab ` +
        `with the "Not shipped" filter to work through them.`,
    };
  }

  if (/(stock|inventory|run out|reorder|cover)/.test(asked)) {
    const critical = stockRows
      .filter((row) => row.band === "critical" || row.band === "low")
      .slice(0, 4);
    return {
      tools: [toolCall("seller_inventory")],
      text:
        `**${critical.length} listings** are inside two weeks of cover:\n\n` +
        critical
          .map(
            (row) =>
              `- ${row.brand_sku} — ${row.name} · ${row.days_of_cover ?? "—"} days left on ${row.channel}`,
          )
          .join("\n") +
        `\n\nPO-2423 covers the brass diyas and lands in four days. Nothing is on order for the seagrass baskets.`,
    };
  }

  if (/(compare|compared|vs\.?|yesterday|last friday|last week|how did)/.test(asked)) {
    // Two adjacent windows, same length, so "yesterday vs. the day before"
    // reads as a fair comparison rather than a today-vs-a-whole-week one.
    const recent = orders.filter((order) => order.ageHours <= 24);
    const prior = orders.filter((order) => order.ageHours > 24 && order.ageHours <= 48);
    const byChannel = (rows: typeof orders, channel: "amazon" | "shopify") =>
      rows
        .filter((order) => order.channel === channel)
        .reduce((sum, order) => sum + (order.merchandise_total ?? 0), 0);
    const rows: [string, number, number][] = [
      ["Amazon", byChannel(recent, "amazon"), byChannel(prior, "amazon")],
      ["Shopify", byChannel(recent, "shopify"), byChannel(prior, "shopify")],
    ];
    const changePct = (now: number, before: number) =>
      before > 0 ? `${now >= before ? "+" : ""}${(((now - before) / before) * 100).toFixed(1)}%` : "—";
    const totalNow = rows.reduce((sum, [, now]) => sum + now, 0);
    const totalBefore = rows.reduce((sum, [, , before]) => sum + before, 0);
    return {
      tools: [toolCall("seller_channels"), toolCall("seller_aggregate"), toolCall("seller_compare")],
      text:
        `Today so far is ${money(totalNow)} against ${money(totalBefore)} the day before ` +
        `(${changePct(totalNow, totalBefore)}).\n\n` +
        `| CHANNEL | TODAY | YESTERDAY | CHANGE |\n` +
        `|---|---|---|---|\n` +
        rows
          .map(
            ([name, now, before]) =>
              `| ${name} | ${money(now)} | ${money(before)} | ${changePct(now, before)} |`,
          )
          .join("\n"),
    };
  }

  if (/(sales|revenue|gmv|selling|today)/.test(asked)) {
    const week = orders.filter((order) => order.ageHours <= 24 * 7);
    const gmv = week.reduce((sum, order) => sum + (order.merchandise_total ?? 0), 0);
    return {
      tools: [toolCall("seller_metrics"), toolCall("seller_aggregate")],
      text:
        `Over the last 7 days you took **${week.length} orders** worth ` +
        `**${money(gmv)}** in merchandise value.\n\n` +
        `Amazon is ${Math.round((week.filter((o) => o.channel === "amazon").length / Math.max(week.length, 1)) * 100)}% ` +
        `of that by order count. The Dashboard tiles compare this against the 7 days before it.`,
    };
  }

  if (/(vendor|deal|worth buying|sheet|source|cream)/.test(asked)) {
    return vendorDealResult(["Sample vendor sheet"], SAMPLE_VENDOR_ROWS);
  }

  if (/(refund|return|cancel)/.test(asked)) {
    const refunded = orders.filter((order) => order.flags.includes("refunded"));
    const cancelled = orders.filter((order) => order.flags.includes("cancelled"));
    return {
      tools: [toolCall("seller_orders")],
      text:
        `In the last 45 days: **${refunded.length} refunded** and **${cancelled.length} cancelled** orders.\n\n` +
        `Neither channel gives us RMA returns, so the return-rate tile on the Dashboard ` +
        `is those two together — it says so on the tile rather than claiming to be a real return rate.`,
    };
  }

  return {
    tools: [],
    text:
      `I can help with **orders**, **stock cover**, **sales**, **refunds**, how ` +
      `channels **compare**, and checking a vendor sheet against your Amazon catalog. ` +
      `Try asking about one of those.`,
  };
}

/**
 * A vendor sheet Nathan-style: what's worth buying, computed the same way the
 * real `seller_evaluate_vendor_deals` tool does (referral + FBA fee estimate,
 * bucketed on gating and margin). The composer parses an uploaded file client
 * side (no backend to upload to in demo mode) and embeds the rows in the
 * message text behind VENDOR_SHEET_MARKER; sendMessage below strips that
 * marker before it ever reaches a chat bubble. Asking without a file falls
 * back to a small fixed sample so the flow works from a typed question too.
 */
const SAMPLE_VENDOR_ROWS: VendorRow[] = [
  { query: "8901234567890", title: "Brass Diya Set, Pack of 6", cost: 180, upc: "8901234567890" },
  { query: "8901234567906", title: "Seagrass Storage Basket, Large", cost: 420, upc: "8901234567906" },
  { query: "Bamboo Serving Tray, Set of 2", title: "Bamboo Serving Tray, Set of 2", cost: 210, upc: null },
  { query: "Ceramic Planter, Medium", title: "Ceramic Planter, Medium", cost: 260, upc: null },
  { query: "8901234567937", title: "Jute Table Runner, 72 inch", cost: 150, upc: "8901234567937" },
  { query: "Woven Placemat Set", title: "Woven Placemat Set", cost: 90, upc: null },
];

function extractVendorSheet(
  text: string,
): { cleanText: string; fileNames: string[]; rows: VendorRow[] } | null {
  const at = text.indexOf(VENDOR_SHEET_MARKER);
  if (at === -1) return null;
  const end = text.lastIndexOf("-->");
  if (end === -1) return null;
  try {
    const payload = JSON.parse(text.slice(at + VENDOR_SHEET_MARKER.length, end)) as {
      fileNames: string[];
      rows: VendorRow[];
    };
    return { cleanText: text.slice(0, at).trim(), fileNames: payload.fileNames, rows: payload.rows };
  } catch {
    return null;
  }
}

function vendorDealResult(fileNames: string[], rows: VendorRow[]): { text: string; tools: ChatToolCall[] } {
  const evaluated = evaluateVendorRows(rows);
  const worthBuying = evaluated.filter((r) => r.bucket === "worth_buying").length;
  return {
    tools: [toolCall("seller_evaluate_vendor_deals", { fileNames, rows: evaluated })],
    text:
      `Checked **${evaluated.length} rows** against your Amazon catalog — gating, current buy box ` +
      `price, and estimated fees. **${worthBuying} are worth buying.**`,
  };
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

  // A file upload rides in as a marker appended to the message — see
  // extractVendorSheet. Stripped before it ever reaches a stored message or
  // the title, so a seller's chat history never shows raw JSON.
  const uploaded = extractVendorSheet(text);
  const shown = uploaded ? uploaded.cleanText : text;

  const seq = chat.messages.length + 1;
  chat.messages.push(message(chat, "user", shown, false, seq));
  chat.title ??= shown.slice(0, 60);
  chat.modified = stamp(new Date());
  const { text: answer, tools } = uploaded
    ? vendorDealResult(uploaded.fileNames, uploaded.rows)
    : answerFor(text);
  chat.pending = {
    seq: seq + 1,
    answer,
    tools,
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
    const { seq, answer, tools, creation } = chat.pending;
    chat.messages.push(message(chat, "assistant", answer, false, seq, creation, tools));
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
      message(
        chat,
        "assistant",
        text,
        true,
        chat.pending.seq,
        chat.pending.creation,
        chat.pending.tools,
      ),
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
          "I've got a vendor sheet — what's worth buying?",
        ],
  };
}
