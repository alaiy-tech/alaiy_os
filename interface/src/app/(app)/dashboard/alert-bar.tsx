"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { dismissAlertAction, type DismissAlertState } from "./actions";
import { Mark } from "@/components/ask/chat";
import { Spinner } from "@/components/ui";
import { alertStyle, alertTarget } from "@/lib/dashboard/alerts";
import type { HomeAlert } from "@/lib/backend/types";

/**
 * What Alaiy noticed overnight, above the recent orders and below the tiles.
 *
 * At most three, ranked by severity rather than by time — the backend caps and
 * ranks them, and this renders them in the order it was given. Each one names
 * what it saw and links to the tab where the seller can do something: Home
 * surfaces the problem, another tab is where it gets fixed.
 *
 * A client component so a dismissal can hide its row before the round trip
 * finishes. Everything else about Home is server-rendered; this is the one
 * thing on the screen a seller changes, and clicking × twice because the first
 * click looked ignored is the failure worth spending a client component on.
 */

export function AlertBar({ alerts }: { alerts: HomeAlert[] }) {
  if (!alerts.length) return null;

  return (
    <section aria-label="What needs attention" className="space-y-2">
      <div className="flex items-center gap-2">
        <Mark size={7} />
        <p className="text-[12px] text-muted">
          {/* Named rather than left as an anonymous "Alerts": these are
              inferences drawn from the seller's own data, and the reader
              deserves to know who is doing the inferring. */}
          Alaiy went through your channels — {alerts.length}{" "}
          {alerts.length === 1 ? "thing" : "things"} worth knowing
        </p>
      </div>

      <ul className="space-y-2">
        {alerts.map((alert) => (
          <AlertCard key={alert.key} alert={alert} />
        ))}
      </ul>
    </section>
  );
}

function AlertCard({ alert }: { alert: HomeAlert }) {
  const [state, submit] = useActionState<DismissAlertState, FormData>(
    dismissAlertAction,
    {},
  );
  // Hidden here the moment it is clicked; the server's `refresh()` is what
  // makes it stay hidden across a reload. Put back if the call fails, because
  // an alert that vanished and was never recorded is worse than a slow one.
  const [dismissed, setDismissed] = useState(false);

  const style = alertStyle(alert.tone);
  const target = alertTarget(alert);
  const gone = dismissed && !state.error;

  if (gone) return null;

  return (
    <li className={`flex overflow-hidden rounded-sm border ${style.card}`}>
      {/* The bright value, as a rule down the leading edge. Three of these
          stacked is how the bar shows its ranking without three type sizes. */}
      <span aria-hidden className={`w-[3px] shrink-0 ${style.rule}`} />

      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-4 gap-y-1.5 px-3.5 py-2.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className={`text-[13px] font-semibold ${style.ink}`}>
            {/* The tone is a colour, and a colour cannot be read out. */}
            <span className="sr-only">{style.srLabel}: </span>
            {alert.title}
          </p>
          {/* The ink at full strength, one step down in size. A dimmed
              version of it is exactly the `text-muted/60` guesswork the
              design system replaced with measured pairs — and this text is
              the half of the alert that says what to do about it. */}
          <p className={`text-[12.5px] leading-snug ${style.ink}`}>{alert.detail}</p>
          {state.error ? (
            <p className="text-[12px] text-alert-ink">
              Couldn&rsquo;t dismiss that — {state.error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {target ? (
            <Link
              href={target.href}
              className={`whitespace-nowrap rounded-xs px-2 py-1 text-[12px] font-medium underline-offset-2 hover:underline ${style.ink}`}
            >
              {target.label} →
            </Link>
          ) : null}

          {/* `dismissed` is set on submit and never cleared: a failure leaves
              it true but `state.error` set, which is what keeps the row on
              screen carrying its own error rather than disappearing having
              recorded nothing. */}
          <form action={submit} onSubmit={() => setDismissed(true)}>
            <input type="hidden" name="key" value={alert.key} />
            <input type="hidden" name="fingerprint" value={alert.fingerprint} />
            <DismissButton ink={style.ink} />
          </form>
        </div>
      </div>
    </li>
  );
}

/**
 * The ×.
 *
 * Not a `Button`: the press is the product's call to action, and dismissing an
 * alert is the opposite of one — it is a way to make something go away. The
 * same reasoning as `quiet` in the design system, at icon scale.
 */
function DismissButton({ ink }: { ink: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title="Dismiss. It comes back if it gets worse, or if it clears and happens again."
      aria-label="Dismiss this alert"
      className={`grid h-7 w-7 place-items-center rounded-xs transition-colors hover:bg-primary-600/10 disabled:cursor-not-allowed ${ink}`}
    >
      {pending ? (
        <Spinner className="h-3.5 w-3.5" />
      ) : (
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        >
          <path d="M6 6l8 8M14 6l-8 8" />
        </svg>
      )}
    </button>
  );
}
