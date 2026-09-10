"use client";

import { useActionState } from "react";
import { startImportAction, type FormState } from "./onboarding-actions";
import { SubmitButton } from "@/components/onboarding/submit-button";
import { Alert } from "@/components/ui";
import { IMPORT_RECENT_WINDOW_LABEL } from "@/lib/channels";

/**
 * The gate between connecting accounts and kicking off the import.
 *
 * The button promises the store rather than a window, because that is what the
 * import delivers — the recent orders land while the seller is still looking
 * at this flow, and their older history keeps arriving afterwards. Saying so
 * in the note below is the difference between a store that is still filling in
 * and one that looks like it imported the wrong amount.
 */
export function ImportLauncher({
  connectedChannels,
}: {
  connectedChannels: string[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    startImportAction,
    {},
  );
  const ready = connectedChannels.length > 0;

  return (
    <form action={formAction} className="space-y-3">
      {connectedChannels.map((channel) => (
        <input key={channel} type="hidden" name="channels" value={channel} />
      ))}

      {state.error ? <Alert>{state.error}</Alert> : null}

      <SubmitButton className="w-full" disabled={!ready}>
        {ready ? "Import my store" : "Connect a channel first"}
      </SubmitButton>

      <p className="text-center text-xs text-muted">
        {ready
          ? `Your listings and the last ${IMPORT_RECENT_WINDOW_LABEL} of orders land first. Older orders keep importing in the background.`
          : "Connect at least one channel above to continue."}
      </p>
    </form>
  );
}
