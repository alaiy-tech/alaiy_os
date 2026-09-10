"use client";

import { useActionState } from "react";
import { startShopifyOAuthAction, type FormState } from "@/lib/connect/actions";
import { Alert, Field, Input } from "@/components/ui";
import { ConnectSubmit } from "./submit";

/**
 * Shopify OAuth entry point: the seller types their store domain and is
 * redirected to Shopify to approve the connection — no copy-pasting tokens.
 *
 * Shared between the onboarding connect step and the Channels tab.
 */
export function ShopifyForm() {
  const [state, formAction] = useActionState<FormState, FormData>(
    startShopifyOAuthAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field
        label="Store domain"
        hint="You'll be taken to Shopify to approve the connection — no copy-pasting tokens."
      >
        <Input
          name="shop"
          placeholder="your-store.myshopify.com"
          autoComplete="off"
          required
        />
      </Field>

      {state.error ? <Alert>{state.error}</Alert> : null}

      <ConnectSubmit className="w-full sm:w-auto">Connect Shopify</ConnectSubmit>
    </form>
  );
}
