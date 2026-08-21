import type { ComponentRegistry } from "@/types/runtime/registry";

/**
 * Component registry entries contributed by the Frappe apps installed
 * alongside the base - the `components` extension point (mirrors
 * `contributed-nav.ts`'s pattern, and the now-obsolete `contributed-products.ts`
 * precedent; see docs/CONNECTOR_TO_BASE_UI_COMPOSITION.md §16.1). Unlike
 * `products`, this point reuses the registry's own `ComponentRegistry` type
 * directly as its contract - no bespoke module needed, since the registry
 * type is already fully general.
 *
 * GENERATED FILE — the deployment composer overwrites it with the merged
 * registry entries declared by every contributing app's own
 * `interface.config.json` `extensions.components` module. It ships empty in
 * `alaiy_os`, which is what keeps the base connector- and client-agnostic:
 * `runtime/resolve-page.tsx` merges this into `baseComponentRegistry` via
 * `mergeRegistries` without knowing which app (or how many) supplied it.
 *
 * Do not hand-edit in a composed workspace — the next compose overwrites it.
 * Do not add entries here in `alaiy_os` itself; a base-owned component
 * belongs in `runtime/registry/component-registry.ts`.
 */
export const contributedComponents: ComponentRegistry = {};
