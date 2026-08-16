import { PROGRESS_STEPS, type ProgressStep, SETTLED_STATUSES } from "@/constants/sales-orders";
import { isPastDue } from "./dates";
import type { SalesOrderHeader } from "@/types/sales-orders";

export { toDateParam, todayIso } from "@/lib/dates";

/** Whether an order's delivery date has passed while it can still be
 * delivered. The settled-status rule mirrors SETTLED_STATUSES in
 * alaiy_os/api/sales_order_stats.py; the highlighted cells are meant to be
 * exactly the orders the Past-due Deliveries KPI counts. */
export function isDeliveryPastDue(deliveryDate: unknown, status: unknown): boolean {
  return isPastDue(deliveryDate, status, SETTLED_STATUSES);
}

export type ProgressState = "done" | "current" | "todo";

export type ProgressStepView = {
  step: ProgressStep;
  state: ProgressState;
  /** The evidence behind the step's state — the linked-document count or the
   * percentage ERPNext is tracking — so a half-finished step says how far. */
  hint: string | null;
};

/** Where the order actually is, as the five fixed lifecycle steps.
 *
 * `per_delivered`/`per_billed` are read rather than recomputed from the lines:
 * ERPNext maintains them as delivery notes and invoices are submitted, and the
 * order's own view of its progress is the one the rest of ERPNext acts on. The
 * linked-document counts only ever feed the hint text — an order can be fully
 * delivered by one note or by five, and neither says anything about progress.
 *
 * A cancelled order (docstatus 2) reports every step as `todo`: it did not
 * finish, and drawing its pre-cancellation progress as still-standing would
 * say it did. The page renders the cancellation itself, above the strip.
 */
export function salesOrderProgress(
  order: Pick<SalesOrderHeader, "docstatus" | "status" | "per_delivered" | "per_billed">,
  counts: { deliveryNotes: number; invoices: number },
): ProgressStepView[] {
  const submitted = order.docstatus === 1;
  const cancelled = order.docstatus === 2;

  const delivered = order.per_delivered ?? 0;
  const billed = order.per_billed ?? 0;

  const done: boolean[] = cancelled
    ? [false, false, false, false, false]
    : [
        // Draft is behind you the moment the order exists at all.
        true,
        submitted,
        submitted && delivered >= 100,
        submitted && billed >= 100,
        submitted && order.status === "Completed",
      ];

  // The first step that isn't done is where the order currently sits. A fully
  // completed order has no such step, and indexOf's -1 never matches an index,
  // so nothing is marked current — which is right: there is nothing in flight.
  // A cancelled order is the same case for a different reason: nothing is in
  // flight there either, and marking Draft "current" would read as an order
  // waiting to be submitted.
  const currentIndex = cancelled ? -1 : done.indexOf(false);

  return PROGRESS_STEPS.map((step, index) => ({
    step,
    state: stepState(done[index], index === currentIndex),
    hint: stepHint(step, { delivered, billed, submitted, cancelled, counts }),
  }));
}

function stepState(done: boolean, isCurrent: boolean): ProgressState {
  if (done) return "done";
  return isCurrent ? "current" : "todo";
}

function stepHint(
  step: ProgressStep,
  ctx: {
    delivered: number;
    billed: number;
    submitted: boolean;
    cancelled: boolean;
    counts: { deliveryNotes: number; invoices: number };
  },
): string | null {
  if (ctx.cancelled) return null;

  switch (step) {
    case "To Deliver":
      if (!ctx.submitted) return null;
      return ctx.counts.deliveryNotes > 0
        ? `${Math.round(ctx.delivered)}% · ${plural(ctx.counts.deliveryNotes, "delivery note", "delivery notes")}`
        : `${Math.round(ctx.delivered)}%`;
    case "To Bill":
      if (!ctx.submitted) return null;
      return ctx.counts.invoices > 0
        ? `${Math.round(ctx.billed)}% · ${plural(ctx.counts.invoices, "invoice", "invoices")}`
        : `${Math.round(ctx.billed)}%`;
    default:
      return null;
  }
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
