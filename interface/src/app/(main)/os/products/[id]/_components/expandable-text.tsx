"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/** How long a description has to be before the toggle is worth drawing at all.
 * Below this it fits inside the clamp on every sensible column width, so the
 * button would expand nothing. */
const EXPAND_THRESHOLD = 180;

/**
 * Body copy clamped to a few lines, with a Read more toggle when there is more
 * to read.
 *
 * The full text is always in the DOM - the clamp is CSS, not a truncated
 * string - so a screen reader and the browser's own find-in-page get the whole
 * description whichever way the toggle is sitting.
 */
export function ExpandableText({ text, clampLines = 3 }: { text: string; clampLines?: 2 | 3 | 4 }) {
  const [expanded, setExpanded] = useState(false);
  const clamp = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4" }[clampLines];

  return (
    <div className="flex flex-col items-start gap-1">
      <p className={cn("text-muted-foreground text-sm leading-relaxed", !expanded && clamp)}>{text}</p>
      {text.length > EXPAND_THRESHOLD && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="font-medium text-sm underline-offset-4 hover:underline"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </div>
  );
}
