import type { UINode } from "@/types/runtime/node";
import type { PageConfigFile } from "@/types/runtime/page-config";
import type { ComponentRegistry } from "@/types/runtime/registry";
import type { ValidateAgainstRegistryOptions } from "@/types/runtime/validation";

import { isValidGridColumnsValue, isValidSpanValue } from "../layout";
import { isComponentNode, isLayoutNode } from "../node";
import { resolveComponent } from "../registry/component-registry";

/**
 * A second, separate validation pass - `runtime/validate/validate.ts` (structural: is
 * this well-formed JSON shaped like a page?) deliberately doesn't know about
 * the registry, so a component `type` there is checked only as "a non-empty
 * string" (see that module's doc comment: "vocabulary is the registry's job,
 * not the schema's"). This is that job: given an already structurally-valid
 * `PageConfigFile`, check it against a real `ComponentRegistry` and the
 * registered Data Source ids - unknown component types, illegal
 * parent/child placement, a component missing a field it can't render
 * without, a literal prop whose value doesn't match its type's
 * `propsSchema`, an out-of-range grid span/columns value, and a `data`
 * binding pointing at a source that was never registered.
 *
 * Kept as a plain function callers opt into (wired into `resolve-page.tsx`
 * today), not folded into `validatePageConfig` itself - the renderer's
 * "Unknown component type" placeholder still exists as a second line of
 * defense for anything this pass doesn't catch or isn't called before, per
 * the plan's "the renderer should not be the primary validation layer."
 */

function spanErrors(nodeId: string, span: Record<string, number> | undefined): string[] {
  if (!span) return [];
  const errors: string[] = [];
  for (const [breakpoint, value] of Object.entries(span)) {
    if (!isValidSpanValue(breakpoint as never, value)) {
      errors.push(`${nodeId}: layout.span.${breakpoint} = ${value} has no matching col-span-* class`);
    }
  }
  return errors;
}

function columnsErrors(nodeId: string, columns: Record<string, number> | undefined): string[] {
  if (!columns) return [];
  const errors: string[] = [];
  for (const [breakpoint, value] of Object.entries(columns)) {
    if (!isValidGridColumnsValue(breakpoint as never, value)) {
      errors.push(`${nodeId}: columns.${breakpoint} = ${value} has no matching grid-cols-* class`);
    }
  }
  return errors;
}

/** `parentKey` is the immediate parent's `type` (a `LayoutType` string for a
 * layout node, a `ComponentType` string for a component node) - `undefined`
 * for a node at the page's own root, which is never constrained by
 * `allowedParents`. */
function walk(
  node: UINode,
  parentKey: string | undefined,
  registry: ComponentRegistry,
  isDataSourceRegistered: (id: string) => boolean,
  errors: string[],
): void {
  errors.push(...spanErrors(node.id, node.layout?.span));

  if (isLayoutNode(node)) {
    if (node.type === "grid") errors.push(...columnsErrors(node.id, node.columns));
    for (const child of node.children) walk(child, node.type, registry, isDataSourceRegistered, errors);
    return;
  }

  if (isComponentNode(node)) {
    const entry = resolveComponent(registry, node.type);
    if (!entry) {
      errors.push(`${node.id}: unknown component type "${node.type}"`);
      return;
    }

    if (parentKey !== undefined && entry.allowedParents && !entry.allowedParents.includes(parentKey as never)) {
      errors.push(`${node.id}: "${node.type}" may not be placed directly under "${parentKey}"`);
    }

    if (node.children && node.children.length > 0 && !entry.supportsChildren) {
      errors.push(`${node.id}: "${node.type}" does not support children`);
    }

    if (entry.requiredFields && entry.requiredFields.length > 0) {
      const supplied = new Set([...Object.keys(node.props ?? {}), ...Object.keys(node.data ?? {})]);
      const missing = entry.requiredFields.filter((field) => !supplied.has(field));
      if (missing.length > 0) {
        errors.push(`${node.id}: "${node.type}" is missing required field(s): ${missing.join(", ")}`);
      }
    }

    if (entry.propsSchema) {
      const result = entry.propsSchema.safeParse(node.props ?? {});
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
          errors.push(`${node.id}: props.${path} ${issue.message}`);
        }
      }
    }

    for (const [propName, ref] of Object.entries(node.data ?? {})) {
      if (!isDataSourceRegistered(ref.source)) {
        errors.push(`${node.id}: data.${propName} references unregistered data source "${ref.source}"`);
      }
    }

    if (node.children) {
      for (const child of node.children) walk(child, node.type, registry, isDataSourceRegistered, errors);
    }
  }
}

/** Returns every registry-level problem found (empty array = valid). Never
 * throws - same "always a value, never an exception" contract as
 * `validatePageConfig`. */
export function validateAgainstRegistry(page: PageConfigFile, options: ValidateAgainstRegistryOptions): string[] {
  const errors: string[] = [];
  for (const child of page.definition.children) {
    walk(child, undefined, options.componentRegistry, options.isDataSourceRegistered, errors);
  }
  return errors;
}
