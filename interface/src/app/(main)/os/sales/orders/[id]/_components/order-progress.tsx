import { Check } from "lucide-react";

import { salesOrderProgress } from "@/lib/sales-orders";
import { cn } from "@/lib/utils";
import type { SalesOrderHeader } from "@/types/sales-orders";

/** The five lifecycle steps as a linear strip.
 *
 * The connector between two steps is filled only when the step *before* it is
 * done, so a half-finished order reads as a solid run that stops where the
 * work stopped — a strip that fills the connector into the current step would
 * claim progress the order has not made. */
export function OrderProgress({
  order,
  deliveryNoteCount,
  invoiceCount,
}: {
  order: SalesOrderHeader;
  deliveryNoteCount: number;
  invoiceCount: number;
}) {
  const steps = salesOrderProgress(order, { deliveryNotes: deliveryNoteCount, invoices: invoiceCount });
  const cancelled = order.docstatus === 2;

  return (
    <ol className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:gap-0">
      {steps.map((entry, index) => {
        const isLast = index === steps.length - 1;

        return (
          <li key={entry.step} className="flex flex-1 gap-3 sm:flex-col sm:gap-2">
            <div className="flex flex-col items-center sm:w-full sm:flex-row">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] tabular-nums",
                  entry.state === "done" && "border-transparent bg-primary text-primary-foreground",
                  entry.state === "current" && "border-primary text-primary ring-2 ring-primary/20",
                  entry.state === "todo" && "border-border text-muted-foreground",
                  cancelled && "border-dashed",
                )}
              >
                {entry.state === "done" ? <Check className="size-3.5" /> : index + 1}
              </span>

              {/* Vertical on mobile (the strip stacks), horizontal from sm up. */}
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "my-1 w-px flex-1 sm:my-0 sm:mx-2 sm:h-px sm:w-auto",
                    entry.state === "done" ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>

            <div className="flex flex-col gap-0.5 pb-2 sm:pr-4">
              <span
                className={cn(
                  "font-medium text-sm",
                  entry.state === "todo" && "text-muted-foreground",
                  entry.state === "current" && "text-primary",
                )}
              >
                {entry.step}
              </span>
              {entry.hint && <span className="text-muted-foreground text-xs tabular-nums">{entry.hint}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
