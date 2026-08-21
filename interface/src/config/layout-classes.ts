import type { Breakpoint } from "@/types/runtime/layout";

/** Responsive span/column Tailwind class lookup tables, expressed only at
 * the breakpoints the `/os` dashboard actually uses (base, md, xl). This is
 * deliberately a closed set of literal class strings rather than a
 * generator, because Tailwind v4's build-time scanner only picks up classes
 * that appear as whole strings somewhere in source - `` `xl:col-span-${n}` ``
 * would silently emit unstyled markup. Extending to a new breakpoint/value
 * is one line in each table below, not a new code path. Consumed by
 * `runtime/layout.ts`'s `gridColsClasses`/`spanClasses`/`isValidSpanValue`/
 * `isValidGridColumnsValue`. */
export const GRID_COLS_CLASSES: Partial<Record<Breakpoint, Record<number, string>>> = {
  base: { 1: "grid-cols-1" },
  md: { 2: "md:grid-cols-2", 3: "md:grid-cols-3" },
  xl: { 4: "xl:grid-cols-4", 12: "xl:grid-cols-12" },
};

export const SPAN_CLASSES: Partial<Record<Breakpoint, Record<number, string>>> = {
  xl: {
    5: "xl:col-span-5",
    6: "xl:col-span-6",
    7: "xl:col-span-7",
    12: "xl:col-span-12",
  },
};
