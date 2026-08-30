import { cn } from "@/utils";
import type { ResponsiveValue } from "@/types/runtime/layout";
import type { LayoutType } from "@/types/runtime/node";

import { gridColsClasses } from "../layout";

/** Maps a layout node's `type` to the wrapper className it renders. Kept as
 * plain className lookups (not components) because every layout primitive
 * here is a single `<div>` - a component per primitive would be an
 * abstraction with nothing behind it. */
export const layoutRegistry: Record<
  LayoutType,
  {
    description: string;
    className: (
      nodeOrGap?: { columns?: ResponsiveValue } | number,
      gapOverride?: number,
    ) => string;
  }
> = {
  /** The page root - `/os`'s outer `flex flex-col gap-4`. */
  stack: {
    description: "Vertical stack of children, each full width.",
    className: (
      nodeOrGap?: { columns?: ResponsiveValue } | number,
      gapOverride = 4,
    ) => {
      const gap = typeof nodeOrGap === "number" ? nodeOrGap : gapOverride;
      return cn("flex flex-col h-[100%]", `gap-${gap ?? 4}`);
    },
  },
  /** The header's action row - filters + separator + settings button. */
  inline: {
    description: "Horizontal row of children, wrapping on small screens.",
    className: (
      nodeOrGap?: { columns?: ResponsiveValue } | number,
      gapOverride = 4,
    ) => {
      const gap = typeof nodeOrGap === "number" ? nodeOrGap : gapOverride;
      return cn("flex flex-wrap items-end justify-end", `gap-${gap ?? 4}`);
    },
  },
  /** A plain, non-visual grouping - `/os` has no card chrome at this level. */
  section: {
    description: "Non-visual grouping of children; no chrome of its own.",
    className: (
      nodeOrGap?: { columns?: ResponsiveValue } | number,
      gapOverride = 4,
    ) => {
      const gap = typeof nodeOrGap === "number" ? nodeOrGap : gapOverride;
      return cn("flex flex-col", `gap-${gap ?? 4}`);
    },
  },
  /** A responsive CSS grid - columns come from the node's own `columns` map. */
  grid: {
    description:
      "Responsive grid; children position themselves via `layout.span`.",
    className: (
      nodeOrGap?: { columns?: ResponsiveValue } | number,
      gapOverride = 4,
    ) => {
      const node = typeof nodeOrGap === "number" ? {} : (nodeOrGap ?? {});
      const gap = typeof nodeOrGap === "number" ? nodeOrGap : gapOverride;
      return cn("grid", `gap-${gap ?? 4}`, ...gridColsClasses(node.columns));
    },
  },
};

export function resolveLayout(type: string) {
  return layoutRegistry[type as LayoutType];
}
