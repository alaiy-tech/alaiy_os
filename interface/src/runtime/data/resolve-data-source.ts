import type { DataSourceRef, DataSourceValue } from "@/types/runtime/data-source-ref";

export type { DataSourceRef } from "@/types/runtime/data-source-ref";

/** The reserved prefix a page-level named `data` dict entry
 * (`types/runtime/page.ts`) resolves under in the flat data record - keeps
 * that keyspace separate from `sourceKey`'s (a bare registry id, or a
 * stable-stringified inline config), so a page reusing the same word for
 * both (e.g. a `data.customers` entry alongside a `{ source: "customers" }`
 * registry binding) can never collide. */
export const PAGE_DATA_PREFIX = "page-data:";

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

/** Like `JSON.stringify`, but sorts object keys at every level (array order
 * is left alone - it's semantically meaningful for `fields`/`filters`, key
 * order isn't). Plain `JSON.stringify` would let two structurally-equal
 * inline configs written with different key order silently resolve as two
 * distinct sources instead of deduping to one. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** The lookup key a `DataSourceRef.source` resolves to in the flat `data`
 * record - shared by `resolvePageData` (which builds that record) and
 * `resolveDataSource` (which reads it back out at render time), so the two
 * independent tree-walks always agree. A registered source's own id is
 * already a stable key (unchanged); an inline declarative config
 * (`FrappeListSourceConfig`/`FrappeCountSourceConfig`) has no id of its own,
 * so its stable-stringified shape stands in for one - which also means two
 * byte-for-byte-equal (ignoring key order) inline configs collapse to one
 * resolved value instead of two redundant Frappe calls. */
export function sourceKey(source: DataSourceValue): string {
  return typeof source === "string" ? source : stableStringify(source);
}

/** Resolves one `DataSourceRef` against a page's data (a plain object keyed
 * by `sourceKey` for a `{ source }` binding, or by `` `${PAGE_DATA_PREFIX}<name>` ``
 * for a `{ ref }` binding into the page's own named `data` dict - see
 * `types/runtime/page.ts`). The runtime never knows what these sources
 * mean, only where to find their already-resolved value. */
export function resolveDataSource(data: Record<string, unknown>, ref: DataSourceRef): unknown {
  const source = "ref" in ref ? data[`${PAGE_DATA_PREFIX}${ref.ref}`] : data[sourceKey(ref.source)];
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
