"use client";

import { useActionState } from "react";
import { connectShopifyAction, type FormState } from "@/lib/connect/actions";
import { Alert, Field, Input } from "@/components/ui";
import { ConnectSubmit } from "./submit";

/**
 * Shopify's credentials: the store, and the custom app's API key pair.
 *
 * Shared, because two screens need it. The onboarding connect step asks for it
 * on the way in, and the Channels tab asks for it when a seller attaches
 * Shopify later — and that second one used to be a link to onboarding, which
 * bounced them to Home. Two copies of a credential form is two things to keep
 * right, so there is one.
 *
 * The Client ID and Secret rather than the Admin API access token the first
 * version asked for. A token from Shopify's client_credentials grant lasts
 * about a day, so a pasted one connected a store that stopped working by the
 * next morning with nobody having touched it; the id and secret mint a fresh
 * token whenever one is needed, including for a sync that runs at 3am. It is
 * also one trip into the Shopify admin instead of two — the same screen that
 * shows the token shows both of these.
 */
export function ShopifyForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    connectShopifyAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Store domain">
        <Input
          name="shop"
          placeholder="your-store.myshopify.com"
          autoComplete="off"
          required
        />
      </Field>

      {/* Both come off one screen, so it is named once, above the pair,
          rather than repeated in two hints that say the same route. */}
      <p className="text-[12px] text-muted">
        Shopify admin → Settings → Apps and sales channels → Develop apps →
        your app → API credentials.
      </p>

      <Field label="Client ID">
        <Input name="client_id" autoComplete="off" required />
      </Field>

      <Field label="Client Secret">
        <Input name="client_secret" type="password" autoComplete="off" required />
      </Field>

      {state.error ? <Alert>{state.error}</Alert> : null}

      <ConnectSubmit className="w-full sm:w-auto">Connect Shopify</ConnectSubmit>
    </form>
  );
}
