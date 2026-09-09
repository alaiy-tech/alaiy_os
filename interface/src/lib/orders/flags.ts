import type { OrderFlagKey, OrderFlagRules } from "@/lib/backend/types";

/**
 * How a problem flag reads.
 *
 * The backend decides *whether* an order is flagged; this decides what the
 * seller is told about it. Client-safe on purpose — the flag chips render in
 * the table, in the detail panel and in the filter bar, and none of those
 * should have to reach the server to know what "stuck" means.
 *
 * Three hues, no more, and each label spells the state out: the colour is a
 * shortcut down a table of four hundred rows, never the only way to read one.
 */

export type FlagTone = "alert" | "warn" | "neutral";

export type FlagPresentation = {
  key: OrderFlagKey;
  /** In the chip. Short enough to sit in a column beside four others. */
  label: string;
  tone: FlagTone;
  /** The tooltip, and the line under the filter. Built from the workspace's
   *  own thresholds where the flag has one, so the number shown is the number
   *  that was actually applied. */
  explain: (rules: OrderFlagRules) => string;
};

const hours = (n: number) => (n === 1 ? "an hour" : `${n} hours`);

/**
 * In the order they are shown, which is the order they matter in.
 *
 * It matches SEVERITY in the backend's order_flags.py — the two would be worth
 * keeping in step even if only the sort depended on it, and the sort does.
 */
export const FLAGS: FlagPresentation[] = [
  {
    key: "unfulfillable",
    label: "Unfulfillable",
    tone: "alert",
    explain: () => "Amazon has marked this order as one it cannot fulfil.",
  },
  {
    key: "payment_pending",
    label: "Payment pending",
    tone: "alert",
    explain: (rules) =>
      `Payment has not been captured, more than ${hours(rules.pending_payment_hours)} after the order was placed.`,
  },
  {
    key: "stuck",
    label: "Not shipped",
    tone: "warn",
    explain: (rules) =>
      `Still unshipped after ${hours(rules.unshipped_hours)} — ${hours(rules.fba_unshipped_hours)} for orders Amazon ships itself.`,
  },
  {
    key: "refunded",
    label: "Refunded",
    tone: "warn",
    explain: () =>
      "Refunded in full or in part. Neither channel gives us RMA returns, so this is the closest thing to one.",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    tone: "neutral",
    explain: () => "Cancelled or voided. Shown so it is visible, not because there is anything to do.",
  },
];

const BY_KEY = new Map(FLAGS.map((flag) => [flag.key, flag]));

export function flagPresentation(key: OrderFlagKey): FlagPresentation | undefined {
  return BY_KEY.get(key);
}

/** Sorted the way the backend ranks them, so the loudest chip comes first. */
export function orderFlags(keys: OrderFlagKey[]): FlagPresentation[] {
  return FLAGS.filter((flag) => keys.includes(flag.key));
}

/** The values the flag filter accepts, and what each one is called. */
export const FLAG_FILTER_OPTIONS = [
  { value: "", label: "Any" },
  { value: "attention", label: "Needs attention" },
  ...FLAGS.map((flag) => ({ value: flag.key, label: flag.label })),
  { value: "clean", label: "No flags" },
];
