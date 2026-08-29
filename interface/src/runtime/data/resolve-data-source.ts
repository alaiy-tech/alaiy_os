import type { DataSourceRef } from "@/types/runtime/data-source";

/** The reserved prefix a page-level named `data` dict entry
 * (`types/runtime/page.ts`) resolves under in the flat data record - kept
 * separate from a registered string source's own bare id (e.g.
 * `"dashboard.greeting"`), so a page reusing the same word for both can
 * never collide. */
export const PAGE_DATA_PREFIX = "page-data:";

const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

/** Safe dot-path getter. No filtering, no transforms, no expressions -
 * missing segments (or a forbidden one - `__proto__`/`constructor`/
 * `prototype`, rejected outright even though plain property reads can't
 * reach a prototype-pollution write path) resolve to `undefined` rather
 * than throwing, so one bad reference degrades that single value instead
 * of crashing the render. Exported: `runtime/data/formula.ts`'s identifier
 * resolution reuses this exact function, so a data binding's `path` and a
 * formula's identifier can never disagree on what a dotted path means. */
export function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (FORBIDDEN_PATH_SEGMENTS.has(key)) return undefined;
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

/** Resolves one `DataSourceRef` against a page's data (a plain object keyed
 * by a registered source's bare id for a `{ source }` binding, or by
 * `` `${PAGE_DATA_PREFIX}<name>` `` for a `{ ref }` binding into the page's
 * own named `data` dict - see `types/runtime/page.ts`). The runtime never
 * knows what these sources mean, only where to find their already-resolved
 * value. */
export function resolveDataSource(data: Record<string, unknown>, ref: DataSourceRef): unknown {
  const source = "ref" in ref ? data[`${PAGE_DATA_PREFIX}${ref.ref}`] : data[ref.source];
  return ref.path ? getPath(source, ref.path) : source;
}

/** Resolves every entry of a node's `data` map, keyed by the prop name it
 * feeds - the renderer merges the result with `props` before calling the
 * registered component. */
export function resolveDataSources(
  data: Record<string, unknown>,
  refs: Record<string, DataSourceRef> | undefined,
): Record<string, unknown> {
  if (!refs) return {};
  const resolved: Record<string, unknown> = {};
  for (const [propName, ref] of Object.entries(refs)) {
    resolved[propName] = resolveDataSource(data, ref);
  }
  return resolved;
}
