import { GRID_COLS_CLASSES, SPAN_CLASSES } from "@/config/layout-classes";
import type { Breakpoint, ResponsiveValue } from "@/types/runtime/layout";

/** Resolves a `columns` map (e.g. `{ base: 1, xl: 12 }`) to the literal
 * `grid-cols-*` classes for a grid container. Unknown breakpoint/value pairs
 * are dropped rather than guessed - the layout registry then falls back to a
 * single column, which fails safely rather than emitting an invalid class. */
export function gridColsClasses(columns: ResponsiveValue | undefined): string[] {
  if (!columns) return ["grid-cols-1"];
  const classes: string[] = [];
  for (const [breakpoint, value] of Object.entries(columns) as [Breakpoint, number][]) {
    const className = GRID_COLS_CLASSES[breakpoint]?.[value];
    if (className) classes.push(className);
  }
  return classes.length > 0 ? classes : ["grid-cols-1"];
}

/** Resolves a child's `span` map to the literal `col-span-*` classes it needs
 * within its parent grid. */
export function spanClasses(span: ResponsiveValue | undefined): string[] {
  if (!span) return [];
  const classes: string[] = [];
  for (const [breakpoint, value] of Object.entries(span) as [Breakpoint, number][]) {
    const className = SPAN_CLASSES[breakpoint]?.[value];
    if (className) classes.push(className);
  }
  return classes;
}

/** True if `value` has a real `col-span-*` class at `breakpoint` - used by
 * `runtime/validate/validate-against-registry.ts` to catch a `layout.span` value that
 * would otherwise silently render with no span class at all (see
 * `spanClasses`'s "unknown pairs are dropped" fallback). */
export function isValidSpanValue(breakpoint: Breakpoint, value: number): boolean {
  return SPAN_CLASSES[breakpoint]?.[value] !== undefined;
}

/** True if `value` has a real `grid-cols-*` class at `breakpoint` - same
 * purpose as `isValidSpanValue`, for a grid layout node's own `columns` map. */
export function isValidGridColumnsValue(breakpoint: Breakpoint, value: number): boolean {
  return GRID_COLS_CLASSES[breakpoint]?.[value] !== undefined;
}
