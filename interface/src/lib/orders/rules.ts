import type { OrderFlagRules } from "@/lib/backend/types";

/**
 * The three thresholds, as the form presents them.
 *
 * Client-safe: the editor is a form on the Orders tab, and the Server Action
 * behind it validates the same bounds. Both read them from here so the number
 * in the error message and the number the backend enforces cannot drift.
 *
 * The bounds match RULE_MIN_HOURS / RULE_MAX_HOURS in the backend's
 * `selfserve/order_flags.py`.
 */

export type RuleKey = keyof OrderFlagRules;

export const RULE_BOUNDS = { min: 2, max: 720 };

export const RULE_FIELDS: {
  key: RuleKey;
  label: string;
  hint: string;
}[] = [
  {
    key: "pending_payment_hours",
    label: "Payment pending",
    hint: "Amazon usually clears a pending order within the hour.",
  },
  {
    key: "unshipped_hours",
    label: "Unshipped, self-ship",
    hint: "Shopify, and Amazon MFN — everything you ship yourself.",
  },
  {
    key: "fba_unshipped_hours",
    label: "Unshipped, FBA",
    hint: "Amazon's own warehouse, which you cannot pick any faster.",
  },
];
