import type { ComponentNode, LayoutNode, UINode } from "@/types/runtime/node";

export function isLayoutNode(node: UINode): node is LayoutNode {
  return node.kind === "layout";
}

export function isComponentNode(node: UINode): node is ComponentNode {
  return node.kind === "component";
}
