import type { ReactNode } from "react";

import { DETAIL_SCROLL_MARGIN } from "@/constants/products";
import { cn } from "@/lib/utils";

/**
 * One titled band of the item page: an h2, an optional right-aligned count, and
 * the content.
 *
 * Every section carries an id and the scroll margin that goes with it, so the
 * jump-to nav lands the heading below the shell's sticky header instead of
 * underneath it. Sections are not Cards here - the page reads as one document
 * with the media column beside it, and a frame around each band fought both the
 * sticky columns and the tables that run edge to edge inside them.
 */
export function PageSection({
  id,
  title,
  meta,
  children,
}: {
  id: string;
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("flex flex-col gap-3", DETAIL_SCROLL_MARGIN)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading font-semibold text-base tracking-tight">{title}</h2>
        {meta ? <span className="text-muted-foreground text-sm tabular-nums">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}
