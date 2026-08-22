/** Responsive span/column values, expressed only at the breakpoints the
 * `/os` dashboard actually uses (base, md, xl). This is deliberately a closed
 * set of literal Tailwind class strings rather than a generator, because
 * Tailwind v4's build-time scanner only picks up classes that appear as whole
 * strings somewhere in source - `` `xl:col-span-${n}` `` would silently emit
 * unstyled markup. Extending to a new breakpoint/value is one line in each
 * lookup table in `config/layout-classes.ts`, not a new code path. */
export type Breakpoint = "base" | "sm" | "md" | "lg" | "xl";

export type ResponsiveValue = Partial<Record<Breakpoint, number>>;
