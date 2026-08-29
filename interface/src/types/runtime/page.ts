import type { ReactNode } from "react";

import type { DataDefinition } from "./data-definition";
import type { UINode } from "./node";
import type { ComponentRegistry } from "./registry";

/** The root of a UI Definition - the whole `headless-dashboard.json` config is
 * one of these. Kept as its own `kind: "page"` (rather than reusing
 * `LayoutNode`) so the runtime always has one unambiguous entry point to walk
 * from, and so `applyUIAction`'s tree helpers never have to special-case "the
 * root has no parent." */
export type UIPageDefinition = {
  id: string;
  kind: "page";
  /** Named, page-scoped data definitions - resolved once each
   * (`runtime/data/resolver.ts`), then referenced by name from any
   * component's `data` binding via `{ ref: "<name>", path? }` instead of
   * duplicating the definition at every binding site. A named entry's
   * result lands in the flat data record under `` `page-data:${name}` ``.
   * Also where a definition's pagination/sort/search/filters become
   * URL-addressable (`resolver.ts`'s `readNamed*` functions, driven by
   * `DataDefinition.query`) - a name is what makes a URL param safe to
   * namespace. `runtime/mutations.ts`'s `applyUIAction` vocabulary doesn't
   * have a verb for this field yet (nothing calls it in production
   * regardless). */
  data?: Record<string, DataDefinition>;
  children: UINode[];
};

export type PageConfigFile = {
  id: string;
  route: string;
  metadata?: { title?: string; description?: string };
  definition: UIPageDefinition;
};

export type ValidationResult = { ok: true; page: PageConfigFile } | { ok: false; errors: string[] };

/** An optional render override for a specific page id - `resolve-page.tsx`
 * uses this instead of the plain `<UIRenderer>` when present. Nothing sets
 * one today (`runtime/page-features.tsx`'s `pageFeatures` is `{}`); the one
 * past use (a dev-only mutation-demo render on the dashboard) moved to
 * `obsolete/` once that page went to production. */
export type PageFeatureBinding = {
  render?: (definition: UIPageDefinition, data: Record<string, unknown>, registry: ComponentRegistry) => ReactNode;
};
