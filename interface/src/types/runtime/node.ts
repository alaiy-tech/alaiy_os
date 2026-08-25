import type { DataSourceRef } from "./data-source-ref";
import type { ResponsiveValue } from "./layout";

/** The registered vocabulary of layout primitives. Kept as a closed union
 * (not an open string) so an invalid config fails at compile time, not just
 * at render time. Layout primitives are structural, not branded vocabulary,
 * so unlike `ComponentType` they don't carry an `os-` prefix. */
export type LayoutType = "section" | "stack" | "inline" | "grid";

/** The registered vocabulary of semantic components - every one of these
 * lives in the single base registry (`runtime/registry/component-registry.ts`)
 * and is genuinely generic: `columns`/`series`/`filters` are declarative
 * specs, not per-page React components, so nothing here is feature-specific
 * anymore (see that file's module doc for why that changed in Round 4).
 * Kept as one flat closed union rather than per-feature module augmentation -
 * a manageable, enumerable list at this scale, and still gives compile-time
 * safety for definitions and tests. A per-feature type-extension mechanism
 * would be the natural next step if a genuinely bespoke component ever
 * doesn't fit this vocabulary. */
export type ComponentType =
  | "os-page-header"
  | "os-card"
  | "os-kpi"
  | "os-data-table"
  | "os-chart"
  | "os-filter-bar"
  | "os-period-toggle";

/** A node's own placement within its parent - never props, never data. Kept
 * as a separate field (not merged into `props`) so layout and composition can
 * never accidentally leak into a component's rendered output. */
export type NodeLayout = {
  span?: ResponsiveValue;
};

export type LayoutNode = {
  id: string;
  kind: "layout";
  type: LayoutType;
  /** Only meaningful for `type: "grid"` - e.g. `{ base: 1, xl: 12 }`. */
  columns?: ResponsiveValue;
  layout?: NodeLayout;
  children: UINode[];
};

/** `data` maps a prop name to a `DataSourceRef` - which named, feature-shaped
 * data source (and optionally which field within it) feeds that prop. It is
 * deliberately a plain lookup, not a query language: the POC only needs to
 * plumb already-shaped server data into already-existing components, not
 * filter/transform it. See `runtime/resolve-data-source.ts`. */
export type ComponentNode = {
  id: string;
  kind: "component";
  type: ComponentType;
  layout?: NodeLayout;
  props?: Record<string, unknown>;
  data?: Record<string, DataSourceRef>;
  /** Only meaningful for registry entries that accept children (`os-page-header`'s
   * action slot, `os-card`'s content). */
  children?: UINode[];
};

export type UINode = LayoutNode | ComponentNode;
