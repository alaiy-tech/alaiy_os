import type React from "react";
import { Fragment } from "react";

import { cn } from "@/lib/utils";
import type { UINode } from "@/types/runtime/node";
import type { UIPageDefinition } from "@/types/runtime/page";
import type { ComponentRegistry } from "@/types/runtime/registry";

import { resolveComponent } from "./component-registry";
import { resolveDataSources } from "./data/resolve-data-source";
import { spanClasses } from "./layout";
import { resolveLayout } from "./layout-registry";
import { isComponentNode, isLayoutNode } from "./node";

/** Rendered in place of a node whose `type` isn't in the registry, instead of
 * throwing - one bad/typo'd node degrades visibly without taking the rest of
 * the page down with it. This is the renderer's only "unknown input" branch;
 * everything else is a static lookup into a `ComponentRegistry`/the layout
 * registry, never `eval`, dynamic `import()`, or any other form of code
 * execution. */
function UnknownNodePlaceholder({ kind, type }: { kind: string; type: string }) {
  return (
    <div className="rounded-md border border-destructive/50 border-dashed p-3 text-destructive text-xs">
      Unknown {kind} type: <code>{type}</code>
    </div>
  );
}

function renderNode(
  node: UINode,
  data: Record<string, unknown>,
  registry: ComponentRegistry,
  key: React.Key,
): React.ReactNode {
  if (isLayoutNode(node)) {
    const layout = resolveLayout(node.type);
    if (!layout) return <UnknownNodePlaceholder key={key} kind="layout" type={node.type} />;

    return (
      <div key={key} className={layout.className({ columns: node.columns })}>
        {node.children.map((child, index) => renderChild(child, data, registry, index))}
      </div>
    );
  }

  if (isComponentNode(node)) {
    const entry = resolveComponent(registry, node.type);
    if (!entry) return <UnknownNodePlaceholder key={key} kind="component" type={node.type} />;

    const bound = resolveDataSources(data, node.data);
    const props: Record<string, unknown> = { ...node.props, ...bound };

    if (node.children && entry.childrenSlot) {
      props[entry.childrenSlot] = node.children.map((child, index) => renderChild(child, data, registry, index));
    }

    const Component = entry.component;
    return (
      <Fragment key={key}>
        <Component {...props} />
      </Fragment>
    );
  }

  return null;
}

/** Wraps a grid child in its own `layout.span` classes before rendering it -
 * span placement belongs to the parent grid, not to the child's own node. */
function renderChild(
  node: UINode,
  data: Record<string, unknown>,
  registry: ComponentRegistry,
  key: React.Key,
): React.ReactNode {
  const span = spanClasses(node.layout?.span);
  if (span.length === 0) return renderNode(node, data, registry, key);

  return (
    <div key={key} className={cn(...span)}>
      {renderNode(node, data, registry, "content")}
    </div>
  );
}

/**
 * Walks a `UIPageDefinition` and renders it against `data` (a page's own
 * named data sources - see `ui-runtime/data/resolve-data-source.ts`) using
 * `registry` (that page's own composed `ComponentRegistry` - see
 * `ui-runtime/registry/component-registry.ts`'s `mergeRegistries`). The
 * renderer itself has zero business-domain knowledge: it never imports a
 * feature's registry or data shape, only whatever is passed in.
 */
export function UIRenderer({
  definition,
  data,
  registry,
}: {
  definition: UIPageDefinition;
  data: Record<string, unknown>;
  registry: ComponentRegistry;
}) {
  return <>{definition.children.map((child, index) => renderChild(child, data, registry, index))}</>;
}
