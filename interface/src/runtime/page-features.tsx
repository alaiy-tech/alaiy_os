import type { PageFeatureBinding } from "@/types/runtime/page";

/**
 * Round 4 note: this file used to also carry a hand-written `loadData`
 * function and a per-page `registry` per page id. Both are gone - data now
 * flows through `resolvePageData` (`runtime/data/resolver.ts`), which
 * resolves whatever the definition itself references via the Data Source
 * Registry, and every component lives in one base registry
 * (`runtime/registry/component-registry.ts`). A page id with no entry here renders
 * through the plain `<UIRenderer>` - the ordinary, expected case for every
 * real JSON-only page today.
 */
export const pageFeatures: Record<string, PageFeatureBinding> = {};
