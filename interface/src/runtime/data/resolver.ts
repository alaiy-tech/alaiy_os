import type { DataSourceContext } from "@/types/runtime/data-source";
import type { DataSourceValue } from "@/types/runtime/data-source-ref";
import type { FrappeCountSourceConfig } from "@/types/runtime/frappe-count";
import type { FrappeListSourceConfig } from "@/types/runtime/frappe-list";
import type { UINode } from "@/types/runtime/node";
import type { UIPageDefinition } from "@/types/runtime/page";

import { isComponentNode, isLayoutNode } from "../node";
import { resolveFrappeCount } from "./frappe-count-resolver";
import { createFrappeListSource } from "./frappe-list-resolver";
import { getDataSource } from "./registry";
import { PAGE_DATA_PREFIX, sourceKey } from "./resolve-data-source";

/** Collects every unique `{ source, path? }`-shaped `DataSourceRef` a
 * definition references, keyed by `sourceKey` - a `Map`, not a `Set`,
 * because an inline source has no name of its own to carry forward; the
 * actual config has to travel with its key so `resolveSource` has
 * something to dispatch on. `{ ref, path? }`-shaped bindings are skipped
 * here entirely - they reference a *named* entry from `definition.data`,
 * resolved separately by `resolveNamedData` below. */
function collectSources(node: UINode, collected: Map<string, DataSourceValue>): void {
  if (isComponentNode(node)) {
    for (const ref of Object.values(node.data ?? {})) {
      if ("source" in ref) collected.set(sourceKey(ref.source), ref.source);
    }
    for (const child of node.children ?? []) collectSources(child, collected);
  } else if (isLayoutNode(node)) {
    for (const child of node.children) collectSources(child, collected);
  }
}

/**
 * Turns one `DataSourceRef.source` into a value. A string resolves through
 * the unchanged Data Source Registry (`dashboard`/`customers` and any other
 * named, domain-specific source) - unregistered still safely degrades to
 * `undefined`, never throws. An inline declarative config
 * (`FrappeListSourceConfig`/`FrappeCountSourceConfig`) has no registry id to
 * look up, so it dispatches on its own `type` instead - a closed switch,
 * exhaustively checked (`never`), so wiring up a future third inline type
 * without adding a case here is a compile error, not silent `undefined` at
 * runtime. Deliberately lives here, not in `registry.ts`: `getDataSource`
 * is a narrow, id-keyed lookup with other real callers
 * (`resolve-page.tsx`'s `isDataSourceRegistered`) that only ever pass a
 * string - an inline config isn't a registry concept, so the dispatch
 * belongs with the one thing that already turns "whatever `DataSourceRef` I
 * found while walking the tree" into "a value."
 */
async function resolveSource(source: DataSourceValue, context: DataSourceContext): Promise<unknown> {
  if (typeof source === "string") {
    const registered = getDataSource(source);
    return registered ? registered.resolve(context) : undefined;
  }

  switch (source.type) {
    case "frappe-list":
      return createFrappeListSource(source).resolve(context);
    case "frappe-count":
      return resolveFrappeCount(source);
    default: {
      const _exhaustive: never = source;
      return undefined;
    }
  }
}

/** Reads `?<name>_page=` for a named page-data entry - e.g. `"customers"` ->
 * `?customers_page=`, mirroring `readPeriod`'s validation shape (an
 * invalid/missing value falls through to the config's own default). This is
 * the ONLY place a page number is read from the URL: a source must have an
 * explicit name (a `definition.data` key) to get URL-addressable pagination
 * at all - an anonymous inline `frappe-list` binding always uses its own
 * static `config.pagination.page`, deliberately (see `page.ts`'s doc
 * comment on why no-name means no interactivity, not an auto-picked
 * default). */
function readNamedPage(searchParams: DataSourceContext["searchParams"], name: string): number | undefined {
  const raw = searchParams[`${name}_page`];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : undefined;
}

/** Resolves every entry of `definition.data` (`types/runtime/page.ts`'s
 * page-level named source dictionary) once each, keyed by
 * `` `${PAGE_DATA_PREFIX}${name}` `` - a keyspace deliberately separate
 * from `sourceKey`'s (see `page.ts`'s doc comment). A named `frappe-list`
 * entry's page number is request-aware (`readNamedPage`); a `frappe-count`
 * entry has no pagination concept and resolves as configured. */
async function resolveNamedData(
  data: Record<string, FrappeListSourceConfig | FrappeCountSourceConfig> | undefined,
  context: DataSourceContext,
): Promise<[string, unknown][]> {
  return Promise.all(
    Object.entries(data ?? {}).map(async ([name, config]) => {
      if (config.type === "frappe-list") {
        const page = readNamedPage(context.searchParams, name) ?? config.pagination.page ?? 1;
        const effectiveConfig: FrappeListSourceConfig = { ...config, pagination: { ...config.pagination, page } };
        return [`${PAGE_DATA_PREFIX}${name}`, await resolveSource(effectiveConfig, context)] as const;
      }
      return [`${PAGE_DATA_PREFIX}${name}`, await resolveSource(config, context)] as const;
    }),
  );
}

/**
 * Replaces the hand-written per-page `loadData` function: walks a
 * definition, collects every unique data source any node's `data` map
 * references (via `resolve-data-source.ts`'s `DataSourceRef.source` - either
 * a named registry id or an inline declarative config), resolves each one
 * exactly once via `resolveSource` in parallel, and separately resolves the
 * page's own named `data` dict (`resolveNamedData`) - also each exactly
 * once, regardless of how many component bindings `{ ref, path? }` into it.
 * The result is the same flat `Record<string, unknown>` `UIRenderer` has
 * always taken as its `data` prop, keyed by `sourceKey` (anonymous
 * bindings) or `` `${PAGE_DATA_PREFIX}<name>` `` (named entries) so
 * `resolveDataSource` (called at render time) looks values back up under
 * the identical key - only *how that object gets built* changes here, not
 * its shape or how `UIRenderer` consumes it.
 *
 * Because this only ever resolves sources the definition itself references,
 * a page's JSON stays the single source of truth for what data it needs -
 * there's no separate loader function to keep in sync with the JSON by hand,
 * and a genuinely new page with no registered feature code still renders
 * (any unregistered string source id still contributes `undefined` - the
 * same safe-degradation the renderer already applies to an unknown
 * component `type`).
 */
export async function resolvePageData(
  definition: UIPageDefinition,
  context: DataSourceContext,
): Promise<Record<string, unknown>> {
  const collected = new Map<string, DataSourceValue>();
  for (const child of definition.children) collectSources(child, collected);

  const [anonymousEntries, namedEntries] = await Promise.all([
    Promise.all(
      [...collected.entries()].map(async ([key, source]) => [key, await resolveSource(source, context)] as const),
    ),
    resolveNamedData(definition.data, context),
  ]);

  return Object.fromEntries([...anonymousEntries, ...namedEntries]);
}
