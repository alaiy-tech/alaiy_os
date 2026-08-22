import type { UINode } from "./node";

/** The root of a UI Definition - the whole `headless-dashboard.json` config is
 * one of these. Kept as its own `kind: "page"` (rather than reusing
 * `LayoutNode`) so the runtime always has one unambiguous entry point to walk
 * from, and so `applyUIAction`'s tree helpers never have to special-case "the
 * root has no parent." */
export type UIPageDefinition = {
  id: string;
  kind: "page";
  children: UINode[];
};
