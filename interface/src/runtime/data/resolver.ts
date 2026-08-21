import type { DataSourceContext } from "@/types/runtime/data-source";
import type { UINode } from "@/types/runtime/node";
import type { UIPageDefinition } from "@/types/runtime/page";

import { isComponentNode, isLayoutNode } from "../node";
import { getDataSource } from "./registry";

function collectSourceNames(node: UINode, names: Set<string>): void {
  if (isComponentNode(node)) {
    for (const ref of Object.values(node.data ?? {})) names.add(ref.source);
    for (const child of node.children ?? []) collectSourceNames(child, names);
  } else if (isLayoutNode(node)) {
    for (const child of node.children) collectSourceNames(child, names);
  }
}

/**
 * Replaces the hand-written per-page `loadData` function: walks a
 * definition, collects every unique data-source `id` any node's `data` map
 * references (via `resolve-data-source.ts`'s `DataSourceRef.source` - the
 * mechanism itself is unchanged from Round 2/3), and resolves each one
 * exactly once through the Data Source Registry, in parallel. The result is
 * the same flat `Record<string, unknown>` `UIRenderer` has always taken as
 * its `data` prop - only *how that object gets built* changes here, not its
 * shape or how `UIRenderer` consumes it.
 *
 * Because this only ever resolves sources the definition itself references,
 * a page's JSON stays the single source of truth for what data it needs -
 * there's no separate loader function to keep in sync with the JSON by hand,
 * and a genuinely new page with no registered feature code still renders
 * (any source id with nothing registered for it just contributes `undefined`
 * - the same safe-degradation the renderer already applies to an unknown
 * component `type`).
 */
export async function resolvePageData(
  definition: UIPageDefinition,
  context: DataSourceContext,
): Promise<Record<string, unknown>> {
  const names = new Set<string>();
  for (const child of definition.children) collectSourceNames(child, names);

  const entries = await Promise.all(
    [...names].map(async (name) => {
      const source = getDataSource(name);
      if (!source) return [name, undefined] as const;
      const value = await source.resolve(context);
      return [name, value] as const;
    }),
  );

  return Object.fromEntries(entries);
}
