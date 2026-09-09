"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveFlagRulesAction, type FlagRulesState } from "./actions";
import { Alert, Button, Spinner } from "@/components/ui";
import { RULE_BOUNDS, RULE_FIELDS } from "@/lib/orders/rules";
import type { OrderFlagRules } from "@/lib/backend/types";

/**
 * The thresholds behind the flags, edited where they are read.
 *
 * A disclosure on the Orders tab rather than a row in a Settings screen. Two
 * reasons: Settings does not exist yet, and more importantly this is a setting
 * a seller only ever wants to change *because of what they are looking at* —
 * "everything is flagged, my dispatch cut-off is 72 hours, not 48". Making
 * them leave the table to fix that is how a setting never gets fixed.
 *
 * Closed by default and quiet when closed: it is a knob, not an invitation.
 * The whole workspace shares it, and the summary line says so, because a
 * threshold that silently changes what a colleague sees is worth announcing.
 */
export function FlagRules({ rules }: { rules: OrderFlagRules }) {
  const [state, action] = useActionState<FlagRulesState, FormData>(
    saveFlagRulesAction,
    {},
  );

  return (
    <details className="group rounded-sm border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[12px] text-muted transition-colors hover:text-primary-600">
        <span
          aria-hidden
          className="text-[10px] transition-transform group-open:rotate-90"
        >
          ▶
        </span>
        Flag rules — payment {rules.pending_payment_hours}h, unshipped{" "}
        {rules.unshipped_hours}h, FBA {rules.fba_unshipped_hours}h
      </summary>

      <form action={action} className="space-y-3 border-t border-line px-3.5 py-3">
        <p className="text-[12px] leading-snug text-muted">
          How long an order may sit before it is flagged. Shared by everyone in
          this workspace, so a change here changes what your colleagues see.
        </p>

        <div className="flex flex-wrap gap-3">
          {RULE_FIELDS.map((field) => (
            <label key={field.key} className="block space-y-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
                {field.label}
              </span>
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  name={field.key}
                  defaultValue={rules[field.key]}
                  min={RULE_BOUNDS.min}
                  max={RULE_BOUNDS.max}
                  step={1}
                  className="h-9 w-20 rounded-sm border border-line bg-white px-2.5 text-[13px] tabular-nums text-ink transition-colors hover:border-primary-600/40 focus:border-highlight-600"
                />
                <span className="text-[12px] text-muted">hours</span>
              </span>
              <span className="block max-w-[15rem] text-[11.5px] leading-snug text-muted-soft">
                {field.hint}
              </span>
            </label>
          ))}
        </div>

        <SaveButton />

        {state.error ? <Alert>{state.error}</Alert> : null}
        {state.notice ? <Alert tone="success">{state.notice}</Alert> : null}
      </form>
    </details>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <Spinner /> : null}
      Save rules
    </Button>
  );
}
