import Link from "next/link";
import type { ComponentProps } from "react";
import { formatNumber } from "@/lib/format";
import { pressClass } from "@/components/ui";

/**
 * Offset pagination for a listing.
 *
 * Links rather than buttons, because the offset lives in the URL like every
 * other part of the query. The ends are rendered as spans, not disabled
 * anchors — an anchor that goes nowhere is still focusable and still looks
 * clickable.
 */

type Href = ComponentProps<typeof Link>["href"];

export function Pagination({
  total,
  start,
  limit,
  hrefFor,
  unit,
}: {
  total: number;
  start: number;
  limit: number;
  /** Given an offset, the href for that page. Built by the calling page. */
  hrefFor: (start: number) => Href;
  /** What is being counted, plural — "products", "order lines". */
  unit: string;
}) {
  if (total === 0) return null;

  const from = start + 1;
  const to = Math.min(start + limit, total);
  const hasPrevious = start > 0;
  const hasNext = to < total;

  // The end of the range is a span, not a press: a button that cannot be
  // pressed should not be wearing the shadow that promises it can.
  const spent =
    "inline-flex h-9 items-center rounded-sm border border-line bg-surface px-4 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-soft";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-[12px] text-muted">
        <span className="font-data font-medium text-primary-600">
          {formatNumber(from)}–{formatNumber(to)}
        </span>{" "}
        of <span className="font-data font-medium text-primary-600">{formatNumber(total)}</span>{" "}
        {unit}
      </p>

      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Link
            href={hrefFor(Math.max(start - limit, 0))}
            className={pressClass({ size: "sm" })}
          >
            Previous
          </Link>
        ) : (
          <span className={spent}>Previous</span>
        )}

        {hasNext ? (
          <Link href={hrefFor(start + limit)} className={pressClass({ size: "sm" })}>
            Next
          </Link>
        ) : (
          <span className={spent}>Next</span>
        )}
      </div>
    </div>
  );
}
