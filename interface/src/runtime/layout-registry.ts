import { cn } from "@/lib/utils";
import type { ResponsiveValue } from "@/types/runtime/layout";
import type { LayoutType } from "@/types/runtime/node";

import { gridColsClasses } from "./layout";

/** Maps a layout node's `type` to the wrapper className it renders. Kept as
 * plain className lookups (not components) because every layout primitive
 * here is a single `<div>` - a component per primitive would be an
 * abstraction with nothing behind it. */
export const layoutRegistry: Record<
  LayoutType,
  {
    description: string;
    className: (node: { columns?: ResponsiveValue }) => string;
  }
> = {
  /** The page root - `/os`'s outer `flex flex-col gap-4`. */
  stack: {
    description: "Vertical stack of children, each full width.",
    className: () => "flex flex-col gap-4",
  },
  /** The header's action row - filters + separator + settings button. */
  inline: {
    description: "Horizontal row of children, wrapping on small screens.",
    className: () => "flex flex-wrap items-end justify-end gap-2",
  },
  /** A plain, non-visual grouping - `/os` has no card chrome at this level. */
  section: {
    description: "Non-visual grouping of children; no chrome of its own.",
    className: () => "flex flex-col gap-4",
  },
  /** A responsive CSS grid - columns come from the node's own `columns` map. */
  grid: {
    description: "Responsive grid; children position themselves via `layout.span`.",
    className: (node) => cn("grid gap-4", ...gridColsClasses(node.columns)),
  },
};

export function resolveLayout(type: string) {
  return layoutRegistry[type as LayoutType];
}
