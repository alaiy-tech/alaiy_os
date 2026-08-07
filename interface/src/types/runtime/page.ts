import type { FrappeCountSourceConfig } from "./frappe-count";
import type { FrappeListSourceConfig } from "./frappe-list";
import type { UINode } from "./node";

/** The root of a UI Definition - the whole `headless-dashboard.json` config is
 * one of these. Kept as its own `kind: "page"` (rather than reusing
 * `LayoutNode`) so the runtime always has one unambiguous entry point to walk
 * from, and so `applyUIAction`'s tree helpers never have to special-case "the
 * root has no parent." */
export type UIPageDefinition = {
  id: string;
  kind: "page";
  /** Named, page-scoped data sources - resolved once each
   * (`runtime/data/resolver.ts`), then referenced by name from any
   * component's `data` binding via `{ ref: "<name>", path? }`
   * (`DataSourceRef`, `types/runtime/data-source-ref.ts`) instead of
   * duplicating the source config at every binding site. A named entry's
   * result lands in the flat data record under `` `page-data:${name}` `` -
   * a keyspace deliberately separate from `sourceKey`'s structural dedup
   * for anonymous inline/registry bindings, so an anonymous binding
   * elsewhere on the page will *not* dedup against a named entry even if
   * byte-for-byte identical - a disclosed non-goal, not an oversight.
   * `runtime/mutations.ts`'s `applyUIAction` vocabulary doesn't have a verb
   * for this field yet (nothing calls it in production regardless). Also
   * where a `frappe-list` entry's pagination becomes URL-addressable -
   * see `resolver.ts`'s `readNamedPage` - an *anonymous* inline
   * `frappe-list` binding has no name to namespace a URL param on, so it
   * always uses its own static `pagination.page`, deliberately. */
  data?: Record<string, FrappeListSourceConfig | FrappeCountSourceConfig>;
  children: UINode[];
};
