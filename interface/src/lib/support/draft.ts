import { daysOpen, isoDate } from "./cases";
import type { CaseDraft, CaseType } from "./types";

/**
 * Drafting, standing in for the model call the real feature would make.
 *
 * There is no live AI wired into this tab — both tones are plain strings,
 * built once and swapped in the panel rather than generated on demand. What
 * they demonstrate is real, though: escalating a draft is exactly the move
 * the issue's own example makes — name how long the case has been open and
 * ask for it to be treated as overdue.
 */
export function escalate(standard: string, opts: { caseId: string; daysOpen: number }): string {
  const { caseId, daysOpen: days } = opts;
  return [
    `I am escalating case #${caseId}, open ${days} day${days === 1 ? "" : "s"} with no resolution.`,
    "",
    standard,
    "",
    "Given the time this has been outstanding, I would appreciate priority handling and a response from a senior member of the Seller Support team.",
  ].join("\n");
}

const OPENERS: Record<CaseType, (subject: string) => string> = {
  listing: (subject) => `I am writing regarding "${subject}."`,
  fba_inventory: (subject) => `I am following up on an FBA inventory discrepancy: "${subject}."`,
  payment: (subject) => `I am writing regarding a payment discrepancy: "${subject}."`,
  policy: (subject) => `I am writing to appeal the policy action described as "${subject}."`,
  general: (subject) => `I am writing regarding "${subject}."`,
};

const ASKS: Record<CaseType, string> = {
  listing: "Please review and reinstate the listing once the issue above has been addressed.",
  fba_inventory:
    "Please reconcile the discrepancy and process reimbursement under Amazon's FBA inventory reimbursement policy where applicable.",
  payment: "Please review the transaction and correct the discrepancy in the next settlement.",
  policy: "Please review the appeal and reverse the action if it was applied in error.",
  general: "Please advise on the next steps to resolve this.",
};

/**
 * What a case gets the moment Jordan enters it — the "Alaiy enriches it with
 * context from orders, listings and inventory" the issue describes, with no
 * SP-API to actually read the case itself. A template built from whatever
 * Jordan typed, not a model reading anything.
 */
export function buildDraft(input: {
  caseId: string;
  subject: string;
  type: CaseType;
  orderRef?: string;
  asin?: string;
  notes?: string;
}): CaseDraft {
  const { caseId, subject, type, orderRef, asin, notes } = input;

  const reference = [orderRef ? `order/shipment ${orderRef}` : null, asin ? `ASIN ${asin}` : null]
    .filter((part): part is string => Boolean(part))
    .join(" and ");

  const standard = [
    "Dear Amazon Seller Support,",
    "",
    OPENERS[type](subject),
    reference ? `This relates to ${reference}.` : null,
    notes || null,
    "",
    ASKS[type],
    "",
    "Thank you,",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { standard, formal: escalate(standard, { caseId, daysOpen: 0 }) };
}

/** The formal variant for a seed case, from its own opened date — so "Idle
 *  11 days" in the table and "open 11 days" in the escalated draft agree. */
export function seedFormal(
  standard: string,
  supportCase: { caseId: string; openedDate: string },
  today = new Date(),
): string {
  return escalate(standard, {
    caseId: supportCase.caseId,
    daysOpen: daysOpen(supportCase, today),
  });
}

/** Re-exported so call sites building seed data only need one import. */
export { isoDate };
