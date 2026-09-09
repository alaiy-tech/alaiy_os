"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { authAction } from "./actions";
import { initialOtpState } from "./otp-state";
import { Alert, Button, Field, Input, Spinner, pressClass } from "@/components/ui";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}

export function SignInForm({
  googleEnabled,
  /** A failed Google round-trip, already turned into copy by the page. */
  error,
}: {
  googleEnabled: boolean;
  error?: string;
}) {
  const [state, formAction] = useActionState(authAction, initialOtpState);
  const codeRef = useRef<HTMLInputElement>(null);

  // Jump straight to the code box the moment it appears.
  useEffect(() => {
    if (state.stage === "code") codeRef.current?.focus();
  }, [state.stage, state.sentAt]);

  return (
    <div className="space-y-5">
      {/* Dropped once the seller does something: their own attempt is the more
          recent news, and its error replaces this one. */}
      {error && !state.error ? <Alert>{error}</Alert> : null}

      {googleEnabled ? (
        <>
          {/* The same press as every other call to action. An anchor, because
              it leaves for Google's consent screen. */}
          <a href="/api/auth/google/start" className={`${pressClass()} w-full`}>
            <GoogleMark />
            Continue with Google
          </a>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}

      <form action={formAction} className="space-y-4">
        {state.stage === "email" ? (
          <>
            <input type="hidden" name="intent" value="send" />
            <Input
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              defaultValue={state.email}
              placeholder="you@yourstore.com"
            />
            <SubmitButton>Send OTP</SubmitButton>
          </>
        ) : (
          <>
            <input type="hidden" name="intent" value="verify" />
            <input type="hidden" name="email" value={state.email} />
            <Field
              label="6-digit code"
              hint={`Sent to ${state.email}. It expires in ${Math.round((state.expiresIn ?? 600) / 60)} minutes.`}
            >
              <Input
                ref={codeRef}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                placeholder="000000"
                className="text-center text-lg tracking-[0.4em]"
              />
            </Field>
            <SubmitButton>Verify and continue</SubmitButton>
          </>
        )}

        {state.error ? <Alert>{state.error}</Alert> : null}
      </form>

      {state.stage === "code" ? (
        // Separate form so these don't submit the code field.
        <form action={formAction} className="flex justify-center gap-4 text-xs">
          <input type="hidden" name="email" value={state.email} />
          <button
            type="submit"
            name="intent"
            value="resend"
            className="text-primary-600 underline-offset-2 hover:underline"
          >
            Resend OTP
          </button>
          <span aria-hidden className="text-line">|</span>
          <button
            type="submit"
            name="intent"
            value="restart"
            className="text-muted underline-offset-2 hover:underline"
          >
            Use a different email
          </button>
        </form>
      ) : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.6 28.2c-.5-1.3-.7-2.8-.7-4.2s.3-2.9.7-4.2v-5.7H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.9l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.7c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.1l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z" />
    </svg>
  );
}
