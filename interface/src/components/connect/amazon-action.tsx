"use client";

import { useActionState } from "react";
import { connectAmazonAction, type FormState } from "@/lib/connect/actions";
import { Select } from "@/components/ui";
import { AMAZON_REGIONS } from "@/lib/auth/amazon-regions";
import { ConnectSubmit } from "./submit";

/**
 * Amazon's action: region, then straight out to Seller Central.
 *
 * The region cannot be dropped to make this a lone button. Consent starts on a
 * region-specific Seller Central domain, so a European seller sent to the North
 * American one simply cannot sign in — and we have nothing to guess from before
 * they are authorised. Inline beside the button keeps it one click.
 *
 * Shared with the Channels tab, like the Shopify form. Note that Amazon's
 * consent returns to the address configured on the bench —
 * /onboarding/connect, which forwards to /start — so a seller who starts here
 * from Channels lands on Home once they are through. They are connected; they
 * just are not looking at the tab they left from.
 */
export function AmazonAction({
  ready,
  unavailable,
}: {
  ready: boolean;
  /** The readiness check itself failed, so we do not know either way. */
  unavailable: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    connectAmazonAction,
    {},
  );

  // Said before the not-configured case, because "we could not check" must
  // never be reported as "it is not set up" — that points at the wrong thing.
  if (unavailable) {
    return (
      <p className="text-[12px] text-warn-ink">
        Couldn&apos;t check availability — that&apos;s on our side.
      </p>
    );
  }

  if (!ready) {
    return (
      <p className="text-[12px] text-muted">
        Not configured on this environment yet.
      </p>
    );
  }

  return (
    <form action={formAction} className="min-w-0 space-y-2">
      {/* One line, always: no wrap, and the select is the part that gives way.
          `w-auto!` because `Select` ships `w-full` and Tailwind emits it after
          `w-auto`, so an unforced override loses and the button drops below.
          Auto lets the native select size to "India (Amazon EU region)", and
          `min-w-0` lets it shrink from there when the row runs out of room. */}
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="amazon-region">
          Your Amazon region
        </label>
        <Select
          id="amazon-region"
          name="region"
          defaultValue="NA"
          className="h-9 w-auto! min-w-0 text-[13px]"
          options={AMAZON_REGIONS.map((region) => ({
            value: region.spapi,
            label: region.label,
          }))}
        />

        <ConnectSubmit className="shrink-0">Connect</ConnectSubmit>
      </div>

      {state.error ? (
        <p className="text-[12px] text-alert-ink">{state.error}</p>
      ) : null}
    </form>
  );
}
