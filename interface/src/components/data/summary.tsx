import type { ReactNode } from "react";

/**
 * The per-channel figures above a listing.
 *
 * One chip per channel rather than a single total, because that is the
 * question a multi-channel seller actually has — "how much of this is
 * Amazon?" — and because a total would hide a channel that has stopped
 * syncing behind one that has not.
 */

export function SummaryStrip({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function SummaryChip({
  channel,
  figures,
}: {
  channel: string;
  figures: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-sm border border-line bg-white px-3.5 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        {channel}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-1">
        {figures.map((figure) => (
          <p key={figure.label} className="text-[13px] text-muted">
            <span className="pr-1 font-data text-[16px] font-semibold text-primary-600">
              {figure.value}
            </span>
            {figure.label}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * One line of figures describing the rows currently on screen.
 *
 * Distinct from the per-channel chips above: those answer "how much of this is
 * Amazon?" over a whole window, and this answers "what have I just narrowed
 * down to?" — so it has to move with every filter, and the numbers in it come
 * from the same query that produced the table rather than from a second one
 * that could disagree with it.
 */
export function TotalsBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-sm border border-line bg-white px-3.5 py-2.5">
      {children}
    </div>
  );
}

export function Figure({
  value,
  label,
  title,
}: {
  value: string;
  label: string;
  /** The footnote a number needs when it is not the obvious thing. */
  title?: string;
}) {
  return (
    <p className="text-[13px] text-muted" title={title}>
      <span className="pr-1 font-data text-[16px] font-semibold text-primary-600">
        {value}
      </span>
      {label}
    </p>
  );
}
