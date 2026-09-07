"use client";

import { useActionState } from "react";
import { startImportAction, type FormState } from "../actions";
import { SubmitButton } from "@/components/onboarding/submit-button";
import { Alert } from "@/components/ui";
import { IMPORT_WINDOW_DAYS_LABEL } from "@/lib/channels";

/** The gate between connecting accounts and kicking off the 90-day backfill. */
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
        {ready
          ? `Import my last ${IMPORT_WINDOW_DAYS_LABEL}`
          : "Connect a channel first"}
      </SubmitButton>

      {!ready ? (
        <p className="text-center text-xs text-muted">
          Connect at least one channel above to continue.
        </p>
      ) : null}
    </form>
  );
}
