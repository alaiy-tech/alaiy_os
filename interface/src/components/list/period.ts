// PERIODS/PERIOD_LABEL now live in src/constants/list.ts and the Period type
// in src/types/list.ts (single source of truth) - this module keeps the
// parsing logic that operates on them, re-exporting what existing imports of
// "@/components/list/period" still expect. Kept dependency-free of any
// "use client" module so Server Components can call readPeriod() directly.
import { PERIODS } from "@/constants/list";
import type { Period } from "@/types/list";

export { PERIOD_LABEL, PERIODS } from "@/constants/list";
export type { Period } from "@/types/list";

export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value);
}

/** Reads a period out of a Next.js page's `searchParams` (already resolved,
 * i.e. after `await`), falling back to `fallback` for anything missing or
 * invalid rather than throwing - a stray/hand-edited URL should never break
 * the page. */
export function readPeriod(
  searchParams: Record<string, string | string[] | undefined>,
  paramName = "period",
  fallback: Period = "1M",
): Period {
  const raw = searchParams[paramName];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isPeriod(value) ? value : fallback;
}
