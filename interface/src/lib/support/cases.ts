import { daysBetween, isoDate } from "@/lib/dates";
import type { CaseStatus, CaseType, SupportCase } from "./types";

export { isoDate };

/**
 * How a case reads: the fixed V1 taxonomy, status presentation, and the
 * urgency a row is sorted and flagged by.
 *
 * Client-safe on purpose, like `lib/orders/flags.ts` — the chips render in
 * the table, the panel and the Home alert bar, and none of those should have
 * to reach a server to know what "pending you" means.
 */

export const CASE_TYPES: { value: CaseType; label: string }[] = [
  { value: "listing", label: "Listing Issue" },
  { value: "fba_inventory", label: "FBA Inventory Discrepancy" },
  { value: "payment", label: "Payment Discrepancy" },
  { value: "policy", label: "Policy Warning / Appeal" },
  { value: "general", label: "General" },
];

const TYPE_LABEL = new Map(CASE_TYPES.map((type) => [type.value, type.label]));

export function caseTypeLabel(type: CaseType): string {
  return TYPE_LABEL.get(type) ?? type;
}

export const STATUS_OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "pending_amazon", label: "Pending Amazon" },
  { value: "pending_seller", label: "Pending you" },
  { value: "resolved", label: "Resolved" },
];

type StatusTone = "ok" | "warn" | "alert" | "brand" | "accent" | "neutral";

export const STATUS_PRESENTATION: Record<CaseStatus, { label: string; tone: StatusTone }> = {
  open: { label: "Open", tone: "accent" },
  pending_amazon: { label: "Pending Amazon", tone: "neutral" },
  pending_seller: { label: "Pending you", tone: "alert" },
  resolved: { label: "Resolved", tone: "ok" },
};

/** Amazon auto-closes a case with no seller reply after this many days. */
export const AUTO_CLOSE_DAYS = 7;
/** The proactive alert's own threshold — a V1 must-have per the issue, not
 *  the same number as the auto-close itself: it exists to give Jordan a
 *  couple of days' warning before that happens. */
export const SLA_ALERT_DAYS = 5;

export function daysOpen(
  supportCase: Pick<SupportCase, "openedDate">,
  today = new Date(),
): number {
  return daysBetween(supportCase.openedDate, today);
}

export function daysSinceLastResponse(
  supportCase: Pick<SupportCase, "lastResponseDate">,
  today = new Date(),
): number | null {
  if (!supportCase.lastResponseDate) return null;
  return daysBetween(supportCase.lastResponseDate, today);
}

export type Urgency = { label: string; tone: "alert" | "warn" } | null;

/**
 * The one urgency chip a row gets, in priority order.
 *
 * A case awaiting Jordan's reply and closing in on Amazon's auto-close is the
 * loudest thing this can say; a case nobody has touched in over a week —
 * whichever side owes the next word — is next. Three hues would dilute this
 * the same way a fourth flag colour would on Orders, so it stays two.
 */
export function urgency(supportCase: SupportCase, today = new Date()): Urgency {
  if (supportCase.status === "resolved") return null;

  if (supportCase.status === "pending_seller") {
    const waiting = daysSinceLastResponse(supportCase, today) ?? daysOpen(supportCase, today);
    if (waiting >= SLA_ALERT_DAYS) {
      const left = Math.max(AUTO_CLOSE_DAYS - waiting, 0);
      return left === 0
        ? { label: "Auto-closes today", tone: "alert" }
        : { label: `Auto-closes in ${left}d`, tone: "alert" };
    }
    return { label: "Awaiting your reply", tone: "warn" };
  }

  const idleDays = daysOpen(supportCase, today);
  if (idleDays > AUTO_CLOSE_DAYS) {
    return { label: `Idle ${idleDays}d`, tone: "warn" };
  }

  return null;
}

/**
 * Where a case lands in "problems first": approaching the auto-close ranks
 * above every other pending-on-Jordan case, which ranks above a case that is
 * merely idle, which ranks above a fresh one. Resolved is always last —
 * archived, not competing for attention.
 */
function urgencyRank(supportCase: SupportCase, today = new Date()): number {
  if (supportCase.status === "resolved") return 0;
  const flag = urgency(supportCase, today);
  if (flag?.tone === "alert") return 4;
  if (supportCase.status === "pending_seller") return 3;
  if (flag?.tone === "warn") return 2;
  return 1;
}

export function sortByUrgency(cases: SupportCase[], today = new Date()): SupportCase[] {
  return [...cases].sort((a, b) => {
    const rankDiff = urgencyRank(b, today) - urgencyRank(a, today);
    if (rankDiff !== 0) return rankDiff;
    // Within a tier, the one that has been sitting longest floats up.
    return daysOpen(b, today) - daysOpen(a, today);
  });
}
