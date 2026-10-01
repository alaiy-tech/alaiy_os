"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { dismissAlertAction, type DismissAlertState } from "@/app/(app)/dashboard/actions";
import { Spinner } from "@/components/ui";
import { alertStyle, alertTarget } from "@/lib/dashboard/alerts";
import type { HomeAlert } from "@/lib/backend/types";

/**
 * What Alaiy noticed, as a column beside the chart.
 *
 * The same alerts the Dashboard's bar renders and the same dismissal — what
 * differs is the shape. Full-width cards stacked under the figures was right
 * when alerts were the only thing below the composer; next to a chart they
 * are a list, so the tone moves off the card and into the icon tile and each
 * row becomes one line of problem and one of what to do about it.
 *
 * A client component for one reason: a dismissal has to hide its row before
 * the round trip finishes, or the seller clicks the × twice.
 */

export function NeedsAttention({ alerts }: { alerts: HomeAlert[] }) {
  return (
    <section
      aria-label="What needs attention"
      className="flex h-full flex-col rounded-lg border border-line bg-white"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
        <h2 className="text-display-sm text-ink">Needs Attention</h2>
        {alerts.length ? (
          <span className="rounded-full bg-surface px-2 py-0.5 font-data text-[11px] font-semibold text-muted tabular-nums">
            {alerts.length}
          </span>
        ) : null}
      </header>

      {alerts.length ? (
        <ul className="divide-y divide-line">
          {alerts.map((alert) => (
            <AlertRow key={alert.key} alert={alert} />
          ))}
        </ul>
      ) : (
        <p className="px-5 py-8 text-center text-[13px] text-muted">
          Nothing needs you right now. Alaiy checks your channels on every sync.
        </p>
      )}
    </section>
  );
}

function AlertRow({ alert }: { alert: HomeAlert }) {
  const [state, submit] = useActionState<DismissAlertState, FormData>(
    dismissAlertAction,
    {},
  );
  // Hidden the moment it is clicked; the server's `refresh()` is what makes it
  // stay hidden across a reload. Put back if the call fails, because an alert
  // that vanished having recorded nothing is worse than a slow one.
  const [dismissed, setDismissed] = useState(false);
  if (dismissed && !state.error) return null;

  const style = alertStyle(alert.tone);
  const target = alertTarget(alert);

  return (
    <li className="group flex items-start gap-3 px-5 py-3.5">
      {/* The tone lives here now, not on the card: a column of three tinted
          cards is a column with no ground left, and the badge ranks them
          just as well at a glance. */}
      <span
        aria-hidden
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${style.badge}`}
      >
        <AlertIcon tone={alert.tone} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">
          {/* The tone is a colour, and a colour cannot be read out. */}
          <span className="sr-only">{style.srLabel}: </span>
          {alert.title}
        </p>
        <p className="pt-0.5 text-[12.5px] leading-snug text-muted">{alert.detail}</p>
        {state.error ? (
          <p className="pt-1 text-[12px] text-alert-ink">
            Couldn&rsquo;t dismiss that — {state.error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {target ? (
          <Link
            href={target.href}
            aria-label={target.label}
            title={target.label}
            className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-canvas hover:text-primary-600"
          >
            <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 4.5 12.5 10 7 15.5" />
            </svg>
          </Link>
        ) : null}
        {/* `dismissed` is set on submit and never cleared: a failure leaves it
            true with `state.error` set, which is what keeps the row on screen
            carrying its own error rather than disappearing silently. */}
        <form action={submit} onSubmit={() => setDismissed(true)}>
          <input type="hidden" name="key" value={alert.key} />
          <input type="hidden" name="fingerprint" value={alert.fingerprint} />
          <DismissButton />
        </form>
      </div>
    </li>
  );
}

function AlertIcon({ tone }: { tone: HomeAlert["tone"] }) {
  if (tone === "alert") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3.5 17.5 16h-15L10 3.5ZM10 8v3.5M10 14h.01" />
      </svg>
    );
  }
  if (tone === "warn") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 8.5h10l-.7 6.5H5.7L5 8.5ZM7.5 8.5V6a2.5 2.5 0 0 1 5 0v2.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13.5V9.5M10 6.5h.01M3 10a7 7 0 1 0 14 0 7 7 0 0 0-14 0Z" />
    </svg>
  );
}

/**
 * The ×.
 *
 * Only once the row is hovered or the button focused — three permanent
 * dismiss crosses down a narrow column read as the point of the list, and the
 * point of the list is the problems. Focus-visible keeps it reachable by
 * keyboard, where hover does not exist.
 */
function DismissButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      title="Dismiss. It comes back if it gets worse, or if it clears and happens again."
      aria-label="Dismiss this alert"
      className="grid h-7 w-7 place-items-center rounded-full text-muted opacity-0 transition-all hover:bg-canvas hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed"
    >
      {pending ? (
        <Spinner className="h-3.5 w-3.5" />
      ) : (
        <svg viewBox="0 0 20 20" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M6 6l8 8M14 6l-8 8" />
        </svg>
      )}
    </button>
  );
}
