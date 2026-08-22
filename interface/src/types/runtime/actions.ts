import type { ComponentNode, UINode } from "./node";

/** The minimal mutation vocabulary an eventual Ask Alaiy integration would
 * produce as structured output. Deliberately just these four - not "every
 * future operation a page editor might want" - because the goal of this POC
 * is proving `definition + action -> new definition` works, not building a
 * page-builder's full command set. */
export type UIAction =
  | { type: "ADD_COMPONENT"; parentId: string; node: UINode; index?: number }
  | { type: "REMOVE_COMPONENT"; componentId: string }
  | { type: "MOVE_COMPONENT"; componentId: string; newParentId: string; index?: number }
  | { type: "UPDATE_COMPONENT"; componentId: string; patch: Partial<Pick<ComponentNode, "props" | "layout">> };
