import type { Metadata } from "next";
import { Eyebrow, Logo } from "@/components/ui";
import { isConfigured } from "@/lib/env";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Get started — Alaiy",
  description: "Connect your Shopify and Amazon data to AI in three steps.",
};

/**
 * Auth entry point. Both sign-up and sign-in land here.
 *
 * The navy panel is the system's masthead: used with intent, on the one screen
 * where the product still has to introduce itself. Everything past sign-in is
 * paper.
 */
export default function StartPage() {
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
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <Logo className="mb-6 lg:hidden" />
            <Eyebrow>Sign in</Eyebrow>
            <h2 className="text-display-md">Get started</h2>
            <p className="text-sm text-muted">
              Sign in or create your workspace. Takes under a minute.
            </p>
          </div>

          <SignInForm googleEnabled={isConfigured("google")} />

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
        </div>
      </section>
    </main>
  );
}
