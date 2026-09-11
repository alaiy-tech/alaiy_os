"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui";
import { channelName } from "@/lib/channels";
import { formatNumber } from "@/lib/format";
import type { ImportJob, ImportStep } from "@/lib/backend/types";

/**
 * How often the browser asks the backend how the import is getting on.
 *
 * The floor, not the cadence: an import that has not changed since the last
 * answer is asked again progressively less often, up to the ceiling. An import
 * runs for minutes and is watched by every seller onboarding at once, so a
 * fixed three-second poll is a lot of identical answers for the backend to
 * compute — and asking faster does not make a queued sync start.
 */
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_INTERVAL_MS = 15000;
const POLL_BACKOFF_FACTOR = 1.5;

/** How long the finished state stays up before it gets out of the way. */
const DONE_LINGER_MS = 6000;

const STEP_LABEL: Record<ImportStep["id"], string> = {
  orders: "Orders",
  inventory: "Inventory",
  settlements: "Settlements",
};

/**
 * The import, watched from wherever the seller happens to be.
 *
 * Onboarding no longer ends on a progress screen — the seller goes straight to
 * Ask Alaiy once the import is queued, and this follows them. It lives in the
 * app layout so it survives navigation between tabs instead of restarting its
 * poll on every one.
 *
 * It is also the only progress surface now, which is why it expands. The
 * per-channel breakdown and any error used to have a page of their own; if a
 * sync fails, this has to be able to say which one and why, or that
 * information has nowhere to go.
 */
export function ImportStatus({ initialJob }: { initialJob: ImportJob | null }) {
  const router = useRouter();
  const [job, setJob] = useState<ImportJob | null>(initialJob);
  // Null means "nobody has said" — the seller has not touched the toggle, so
  // the default below applies. Once they do, their choice sticks.
  const [expandedByChoice, setExpandedByChoice] = useState<boolean | null>(null);
  const [hidden, setHidden] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  // So the completion refresh fires once, on the transition, rather than on
  // every poll that happens to come back "completed".
  const settled = useRef(initialJob?.status === "completed");

  const status = job?.status;
  const running = status === "queued" || status === "running";
  const failed = status === "failed";
  const done = status === "completed";

  // A failure opens itself. This is the only surface carrying the per-channel
  // breakdown now that the progress screen is gone, so making the seller click
  // to find out which sync broke would be hiding the one thing they need.
  //
  // Derived rather than pushed into state by an effect: the failure can arrive
  // on any poll, and "open because it failed" is a fact about the job, not an
  // event to react to.
  const expanded = expandedByChoice ?? failed;

  // The job's id rather than the job: every poll replaces `job` with a freshly
  // parsed object, so depending on it re-ran this effect on each response —
  // which tore down the interval before it could elapse and fired the immediate
  // poll below again. The cadence was one request per round trip, not one per
  // three seconds, from every seller importing at once.
  const jobId = job?.id ?? null;

  useEffect(() => {
    if (!running) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = POLL_INTERVAL_MS;
    let previous = "";
    const query = jobId ? `?job=${encodeURIComponent(jobId)}` : "";

    // Chained rather than an interval, because the delay changes between polls
    // and because it cannot overlap: one slow answer does not queue up the next
    // request behind it.
    async function poll() {
      try {
        const response = await fetch(`/api/import/status${query}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(String(response.status));
        const next = (await response.json()) as ImportJob | null;
        if (cancelled || !next) return;
        setUnreachable(false);
        setJob(next);

        // An import that is visibly moving is worth watching closely. One that
        // has not changed since the last answer is not, and the seller is told
        // they can go and look around — so the poll eases off and comes back to
        // the floor the moment something moves.
        const snapshot = JSON.stringify([next.status, next.progress, next.steps]);
        delay =
          snapshot === previous
            ? Math.min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_INTERVAL_MS)
            : POLL_INTERVAL_MS;
        previous = snapshot;
      } catch {
        // A blip should not look like a failed import. It should also not be
        // retried at full speed: if the backend is the thing struggling, this
        // is the last poller that should be adding to it.
        if (!cancelled) setUnreachable(true);
        delay = Math.min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_INTERVAL_MS);
      } finally {
        if (!cancelled) timer = setTimeout(poll, delay);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, running]);

  // The moment it finishes, everything the server rendered while the import was
  // running is stale: Ask Alaiy is still disabled, and Orders and Inventory
  // still carry their "still importing" banner. Refreshing is what clears them
  // without asking the seller to reload.
  useEffect(() => {
    if (!done || settled.current) return;
    settled.current = true;
    router.refresh();
    const timer = setTimeout(() => setHidden(true), DONE_LINGER_MS);
    return () => clearTimeout(timer);
  }, [done, router]);

  if (!job || hidden) return null;

  const progress = job.progress ?? 0;
  const steps = job.steps ?? [];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-40 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-sm border-2 border-primary-600 bg-white shadow-float"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="mt-0.5 shrink-0">
          {running ? (
            <Spinner className="text-highlight-600" />
          ) : failed ? (
            <span
              aria-hidden
              className="grid h-4 w-4 place-items-center rounded-full bg-alert text-[10px] font-bold text-white"
            >
              !
            </span>
          ) : (
            <span
              aria-hidden
              className="grid h-4 w-4 place-items-center rounded-full bg-ok text-[9px] font-bold text-white"
            >
              ✓
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-display text-display-xs font-bold text-ink">
            {running
              ? "Importing your data"
              : failed
                ? "Import didn't finish"
                : "Your data is ready"}
          </p>
          <p className="text-[12px] leading-relaxed text-muted">
            {running
              ? "You can keep looking around — Orders and Inventory fill in as it goes."
              : failed
                ? "Some of it landed. Expand for what failed."
                : "Ask Alaiy and your tabs are up to date."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {steps.length ? (
            <button
              type="button"
              onClick={() => setExpandedByChoice(!expanded)}
              aria-expanded={expanded}
              className="rounded-xs px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted hover:bg-primary-600/5 hover:text-primary-600"
            >
              {expanded ? "Hide" : "Details"}
            </button>
          ) : null}
          {/* Only once it has stopped — while it is running, this is the
              only place the seller can see what is happening. */}
          {running ? null : (
            <button
              type="button"
              onClick={() => setHidden(true)}
              aria-label="Dismiss"
              className="rounded-xs px-1.5 py-0.5 text-[13px] leading-none text-muted hover:bg-primary-600/5 hover:text-primary-600"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {running ? (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 border-t border-line bg-surface"
        >
          <div
            className="h-full bg-highlight-500 transition-[width] duration-500"
            style={{ width: `${Math.max(progress, 2)}%` }}
          />
        </div>
      ) : null}

      {expanded && steps.length ? (
        <ul className="divide-y divide-line border-t border-line">
          {steps.map((step) => (
            <li
              key={`${step.channel}-${step.id}`}
              className="flex items-baseline justify-between gap-3 px-4 py-2"
            >
              <span className="text-[12px] text-ink">
                {channelName(step.channel)} · {STEP_LABEL[step.id] ?? step.id}
              </span>
              <StepState step={step} />
            </li>
          ))}
        </ul>
      ) : null}

      {unreachable && running ? (
        <p className="border-t border-line px-4 py-2 text-[11px] text-muted">
          Lost contact for a moment. Still retrying.
        </p>
      ) : null}
    </div>
  );
}

function StepState({ step }: { step: ImportStep }) {
  if (step.status === "done") {
    return (
      <span className="shrink-0 font-data text-[12px] text-ok-ink">
        {formatNumber(step.processed)} imported
      </span>
    );
  }
  if (step.status === "failed") {
    return (
      <span
        className="shrink-0 text-right text-[12px] font-medium text-alert-ink"
        title={step.error}
      >
        Failed
      </span>
    );
  }
  if (step.status === "skipped") {
    // The seller's own permission setting stopped it, which is not a failure
    // and must not be painted as one. The reason is the step's `error`, so it
    // is on the tooltip where a failure's reason already is.
    return (
      <span className="shrink-0 text-[12px] text-muted" title={step.error}>
        Not allowed
      </span>
    );
  }
  if (step.status === "running") {
    return (
      <span className="shrink-0 font-data text-[12px] font-medium text-highlight-700">
        {formatNumber(step.processed)}
        {step.total ? ` / ${formatNumber(step.total)}` : ""}
      </span>
    );
  }
  return <span className="shrink-0 text-[12px] text-muted">Queued</span>;
}
