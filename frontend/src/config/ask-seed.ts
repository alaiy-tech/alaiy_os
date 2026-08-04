/**
 * Seeded Ask Alaiy conversation + prompts, lifted verbatim from askVals() in
 * the approved design. There is no live AI backend for this app yet (the
 * desk's own "Ask Alaiy" page is the same kind of UI-only stub - see
 * alaiy_os/page/ask_alaiy/ask_alaiy.js) - this is an honest scripted demo of
 * the intended interaction, not a wired integration.
 */
export interface AskMessage {
  role: "user" | "ai";
  text: string;
  action?: string;
  actionMeta?: string;
}

export const ASK_SEED_THREAD: AskMessage[] = [
  {
    role: "user",
    text: "Which items are at risk of stocking out in the next 7 days across the Mumbai and Delhi warehouses?",
  },
  {
    role: "ai",
    text: "14 items fall below their reorder level within 7 days at current run-rate. The three largest by open order value are Nordic Oak Dining Table 180cm (4 days of cover), Brass Pendant Light set of 3 (5 days) and Walnut Office Desk 140cm (6 days).",
    action: "Queried Bin, Item and Sales Order",
    actionMeta: "3 doctypes · 41,208 rows scanned · 0.8s",
  },
  { role: "user", text: "Draft purchase orders for those three against their default suppliers." },
  {
    role: "ai",
    text: "Three draft Purchase Orders are ready for review. Nothing has been submitted — each one needs your approval before it leaves Draft.",
    action: "Agent: create Purchase Order ×3",
    actionMeta: "PUR-ORD-2026-01188, 01189, 01190 · total ₹84,12,000 · status Draft",
  },
];

export const ASK_FOLLOWUP: AskMessage = {
  role: "ai",
  text: "Working on it — reading the relevant doctypes now. (Ask Alaiy is a UI preview in this build; answers beyond the seeded thread aren't wired to a live agent yet.)",
  action: "Planning",
  actionMeta: "Resolving doctypes and permissions",
};

export const ASK_STARTERS = [
  { label: "Which SKUs will stock out this week?", meta: "Reads Bin, Item, Sales Order" },
  { label: "Top 10 customers by gross margin", meta: "Reads Sales Invoice, Item" },
  { label: "Draft a reorder for Havelock Retail", meta: "Agent · creates Purchase Order drafts" },
  { label: "Why did on-time fulfilment drop?", meta: "Reads Delivery Note, Sales Order" },
];

export const ASK_QUICK_SUGGESTIONS = ["Top 10 customers by margin", "Why is on-time fulfilment down?", "Reconcile Mumbai stock"];

export const ASK_THREAD_TITLE = "Stock-out risk, Mumbai & Delhi";
export const ASK_THREAD_META = `${ASK_SEED_THREAD.length} messages · reads Item, Bin, Sales Order, Purchase Order`;

export const ASK_HISTORY = [
  { title: "Stock-out risk, Mumbai & Delhi", meta: "4 messages · now", current: true },
  { title: "Q2 margin by customer group", meta: "9 messages · 2 h ago" },
  { title: "Why did AOV drop last week?", meta: "6 messages · yesterday" },
  { title: "Reconcile Bhiwandi cycle count", meta: "12 messages · 2 days ago" },
];
