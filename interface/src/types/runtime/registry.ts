import type { ComponentType as ReactComponentType } from "react";

import type { ZodTypeAny } from "zod";

import type { ComponentType, LayoutType } from "./node";

/** What a future AI system (or `runtime/validate-against-registry.ts` today)
 * can do with this component without reading its implementation. Both flags
 * default to governance-appropriate for an unlabeled entry - `false`/`false`,
 * the safest assumption for an ad hoc registry override (e.g. the
 * `mergeRegistries` test fixture) that doesn't bother declaring them. */
export type ComponentCapabilities = {
  /** Can `MOVE_COMPONENT` legally relocate this node elsewhere in the tree? */
  movable?: boolean;
  /** Can this node's `layout.span` be changed (e.g. via `UPDATE_COMPONENT`)? */
  resizable?: boolean;
};

/**
 * The vocabulary a future AI system reads: a stable semantic `type`, the real
 * React component it resolves to, a plain-English `description`, and
 * (optional) the prop name a node's rendered `children` are passed as.
 *
 * `capabilities`/`allowedParents`/`supportsChildren`/`requiredFields`/
 * `propsSchema` are all optional so a minimal ad hoc entry (a test fixture,
 * an early feature override) still type-checks - but every entry in
 * `baseComponentRegistry` (`runtime/component-registry.ts`) populates all
 * five, since that's what makes the registry a real machine-readable
 * contract rather than just a type-to-component map.
 */
export type ComponentRegistryEntry = {
  type: ComponentType;
  // biome-ignore lint/suspicious/noExplicitAny: the registry deliberately holds components with unrelated prop shapes.
  component: ReactComponentType<any>;
  description: string;
  /** Prop name the renderer assigns a node's rendered `children` to. Omit for
   * leaf components that never take children. */
  childrenSlot?: string;
  capabilities?: ComponentCapabilities;
  /** Layout container types (or, for a component that can itself hold a
   * component directly, other component types) this type may be placed
   * under. `undefined` means unconstrained - checked by
   * `runtime/validate-against-registry.ts`, not by the renderer or the
   * mutation actions (which only ever check "is the parent a layout node at
   * all" - see `runtime/mutations.ts`'s module doc). */
  allowedParents?: (LayoutType | ComponentType)[];
  /** Whether a node of this type may legally have a non-empty `children`
   * array. Distinct from `childrenSlot`: this is "does it accept children at
   * all," `childrenSlot` is "which prop do they render into." */
  supportsChildren?: boolean;
  /** Prop/data-binding keys this component can't render meaningfully
   * without - checked against the union of a node's `props` keys and `data`
   * keys (either satisfies a field), since some required values (e.g.
   * `os-kpi`'s `value`) are always supplied via a data binding, never a
   * literal prop. */
  requiredFields?: string[];
  /** Per-type validation of a node's literal `props` values - never its
   * `data` bindings, which resolve at render time and are checked only for
   * "does this source id exist" (see `validate-against-registry.ts`). Every
   * field should be declared `.optional()` even where `requiredFields`
   * lists it as required: a required field supplied via `data` instead of a
   * literal prop is legitimately absent from `props` entirely, and presence
   * is `requiredFields`' job, not this one's - `propsSchema` only judges the
   * *shape* of whatever literal props are actually present. */
  propsSchema?: ZodTypeAny;
};

export type ComponentRegistry = Partial<Record<ComponentType, ComponentRegistryEntry>>;
