import type { DataSourceRef } from "@/types/runtime/data-source-ref";

export type { DataSourceRef } from "@/types/runtime/data-source-ref";

/** Safe dot-path getter, scoped to whatever a single named source resolved
 * to. Deliberately just a path lookup: no filtering, no transforms, no
 * expressions - missing segments resolve to `undefined` rather than
 * throwing, so one bad reference degrades that single prop instead of
 * crashing the render. */
function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

/** Resolves one `DataSourceRef` against a page's data (a plain object keyed
 * by source name). The runtime never knows what these sources mean, only
 * that they're named slices of `data`. */
export function resolveDataSource(data: Record<string, unknown>, ref: DataSourceRef): unknown {
  const source = data[ref.source];
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
