import type { UIAction } from "@/types/runtime/actions";
import type { UINode } from "@/types/runtime/node";
import type { UIPageDefinition } from "@/types/runtime/page";

import { isLayoutNode } from "./node";

/** Depth-first search for a node by id, anywhere in the tree (including the
 * implicit root's own children array). Returns `undefined` if nothing
 * matches - callers treat a missing id as a no-op, never a crash. */
export function findNode(root: UIPageDefinition, id: string): UINode | undefined {
  function search(nodes: UINode[]): UINode | undefined {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (isLayoutNode(node)) {
        const found = search(node.children);
        if (found) return found;
      } else if (node.children) {
        const found = search(node.children);
        if (found) return found;
      }
    }
    return undefined;
  }
  return search(root.children);
}

/** True if `id` is `node`'s own id, or belongs to any descendant of `node`.
 * Used to reject a MOVE_COMPONENT that would relocate a node into itself or
 * into its own subtree - without this check, `removeFromTree` (which runs
 * first) can remove the destination along with the node being moved, and the
 * subsequent insert silently no-ops, losing the node entirely. */
function containsId(node: UINode, id: string): boolean {
  if (node.id === id) return true;
  const children = isLayoutNode(node) ? node.children : (node.children ?? []);
  return children.some((child) => containsId(child, id));
}

function removeFromTree(nodes: UINode[], id: string): { nodes: UINode[]; removed: UINode | null } {
  let removed: UINode | null = null;

  const next = nodes.filter((node) => {
    if (node.id === id) {
      removed = node;
      return false;
    }
    return true;
  });

  if (removed) return { nodes: next, removed };

  const withRecursed = nodes.map((node) => {
    if (!isLayoutNode(node)) return node;
    const result = removeFromTree(node.children, id);
    if (result.removed) {
      removed = result.removed;
      return { ...node, children: result.nodes };
    }
    return node;
  });

  return { nodes: removed ? withRecursed : nodes, removed };
}

function insertIntoTree(nodes: UINode[], parentId: string, node: UINode, index?: number): UINode[] {
  return nodes.map((current) => {
    if (!isLayoutNode(current)) return current;

    if (current.id === parentId) {
      const children = [...current.children];
      const at = index === undefined ? children.length : Math.max(0, Math.min(index, children.length));
      children.splice(at, 0, node);
      return { ...current, children };
    }

    const children = insertIntoTree(current.children, parentId, node, index);
    return children === current.children ? current : { ...current, children };
  });
}

function updateInTree(nodes: UINode[], id: string, patch: Record<string, unknown>): UINode[] {
  let changed = false;

  const next = nodes.map((node) => {
    if (node.id === id) {
      changed = true;
      return { ...node, ...patch };
    }
    if (isLayoutNode(node)) {
      const children = updateInTree(node.children, id, patch);
      if (children === node.children) return node;
      changed = true;
      return { ...node, children };
    }
    if (node.children) {
      const children = updateInTree(node.children, id, patch);
      if (children === node.children) return node;
      changed = true;
      return { ...node, children };
    }
    return node;
  });

  return changed ? next : nodes;
}

/**
 * Applies one structured UI action to a `UIPageDefinition`, returning a new
 * definition. Pure and immutable: `definition` (and every node not on the
 * changed branch) is untouched, never mutated in place - this is the
 * contract an eventual `LLM -> structured action` integration depends on,
 * since it can never be trusted to hand back a whole new tree, only a small
 * targeted instruction.
 */
export function applyUIAction(definition: UIPageDefinition, action: UIAction): UIPageDefinition {
  switch (action.type) {
    case "ADD_COMPONENT": {
      const parent = findNode(definition, action.parentId);
      if (!parent || !isLayoutNode(parent)) return definition;
      const children = insertIntoTree(definition.children, action.parentId, action.node, action.index);
      return { ...definition, children };
    }

    case "REMOVE_COMPONENT": {
      const { nodes } = removeFromTree(definition.children, action.componentId);
      return { ...definition, children: nodes };
    }

    case "MOVE_COMPONENT": {
      // Validated entirely against the ORIGINAL tree, before anything is
      // removed - MOVE_COMPONENT v1 only relocates between layout containers
      // (Grid/Section/Stack/Inline); a ComponentNode's special-purpose
      // children slot (e.g. os-page-header's action slot) is not a valid
      // move target and is rejected the same way an unknown id is.
      const target = findNode(definition, action.componentId);
      if (!target) return definition;

      const newParent = findNode(definition, action.newParentId);
      if (!newParent || !isLayoutNode(newParent)) return definition;

      if (containsId(target, action.newParentId)) return definition;

      const { nodes, removed } = removeFromTree(definition.children, action.componentId);
      if (!removed) return definition;
      const children = insertIntoTree(nodes, action.newParentId, removed, action.index);
      return { ...definition, children };
    }

    case "UPDATE_COMPONENT": {
      const children = updateInTree(definition.children, action.componentId, action.patch);
      return { ...definition, children };
    }

    default:
      return definition;
  }
}
