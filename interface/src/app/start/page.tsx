import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { isConfigured } from "@/lib/env";
import { getSession } from "@/lib/auth/dal";
import { effectiveStep } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/backend/workspace";
import { callbackError } from "./callback-errors";
import { ConnectStep } from "./connect-step";
import { ProfileStep } from "./profile-step";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Get started — Alaiy",
  description: "Connect your Shopify and Amazon data to AI in three steps.",
};

/**
 * Getting started, end to end: sign-in and the onboarding steps behind it.
 *
 * The navy panel is the system's masthead: used with intent, on the one screen
 * where the product still has to introduce itself. Everything past onboarding
 * is paper.
 *
 * Onboarding used to be its own route with its own chrome, so verifying a code
 * threw the seller off this screen and onto a different-looking one mid-signup.
 * It is the same column now — the form is replaced by the step, the masthead
 * stays put, and the flow reads as one continuous thing. Which step shows is
 * still decided server-side from the session, so a reload, a bookmark or the
 * round-trip out to Amazon all land in the right place.
 */
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const session = await getSession();
  const { error, connected } = await searchParams;

  const step = session ? effectiveStep(session.onboardingStep) : null;
  if (step === "done") redirect("/home");

  // The session can be older than the completion — someone who finished before
  // it was persisted, or who has the tab open in a second browser. The
  // workspace is the authority, so ask it; a stale cookie is repaired by the
  // refresh handler, which unlike a page is allowed to write one.
  //
  // One call per view of this screen, and only until the seller is through.
  let completed = false;
  if (session) {
    try {
      completed = Boolean(
        (await getWorkspace(session.workspaceId, session.backendToken))
          .onboarding_complete,
      );
    } catch {
      // Logged by the backend client. Carrying on shows the flow, which is the
      // safe failure: repeating a step costs a moment, and locking a seller out
      // of onboarding they have not finished costs them the product.
    }
  }
  // `redirect` throws to unwind, so it has to sit outside the try block.
  if (completed) redirect("/api/auth/refresh?next=/home");

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="hidden flex-col justify-between bg-primary-600 p-12 text-white lg:flex">
        <Logo onDark />

        <div className="max-w-md space-y-8">
          {/* The accent underline is the hero's own device, and the only
              decoration on either headline. */}
          <h1 className="text-display-xl">
            Your store data,
            <br />
            <span className="relative inline-block text-highlight-300">
              answerable.
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 h-[3px] w-full bg-highlight-300/50"
              />
            </span>
          </h1>
          <ul className="space-y-5">
            {[
              ["Access", "Every order, SKU and settlement in one place."],
              ["Decide", "Ask Alaiy for reports, alerts and analysis."],
              ["Act", "Agents that read and write. Coming soon."],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-highlight-300 ring-4 ring-highlight-300/20" />
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-sm text-white/70">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/60">
          Free up to 300 orders a month. No card required.
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        {/* The steps carry rows and forms the sign-in column never had, so the
            measure widens once there is a session. */}
        <div className={`w-full space-y-8 ${session ? "max-w-xl" : "max-w-sm"}`}>
          <Logo className="lg:hidden" />

          {session ? (
            <>
              {step === "profile" ? (
                <ProfileStep />
              ) : (
                <ConnectStep
                  session={session}
                  error={callbackError(error)}
                  connected={connected}
                />
              )}

              {/* Onboarding's own chrome carried these. Someone who signed in
                  as the wrong account is otherwise stuck: this screen no longer
                  offers them a form to sign in with. */}
              <div className="flex items-center justify-between gap-4 border-t border-line pt-4 text-xs text-muted">
                <span className="truncate">Signed in as {session.email}</span>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="shrink-0 underline-offset-2 hover:text-primary-600 hover:underline"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="text-display-md">Get started</h2>
                <p className="text-sm text-muted">
                  Connect your stores, and scale your business with AI.
                </p>
              </div>

              <SignInForm
                googleEnabled={isConfigured("google")}
                error={callbackError(error)}
              />

              <p className="text-center text-xs leading-relaxed text-muted">
                By continuing you agree to the Alaiy{" "}
                <a href="https://alaiy.com/terms" className="underline underline-offset-2">
                  terms
                </a>{" "}
                and{" "}
                <a href="https://alaiy.com/privacy" className="underline underline-offset-2">
                  privacy policy
                </a>
                .
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
