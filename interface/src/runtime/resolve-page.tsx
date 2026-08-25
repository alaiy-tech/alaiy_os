import type { ReactNode } from "react";

import "./data/sources"; // registers every data source as a side effect - see sources/index.ts

import { contributedComponents } from "@/config/contributed-components";
import type { PageConfigFile } from "@/types/runtime/page-config";

import { getDataSource } from "./data/registry";
import { resolvePageData } from "./data/resolver";
import { pageFeatures } from "./page-features";
import { baseComponentRegistry, mergeRegistries } from "./registry/component-registry";
import { InvalidPageConfigError } from "./store/invalid-page-config-error";
import { getPageStore } from "./store/sqlite-page-store";
import { UIRenderer } from "./ui-renderer";
import { validateAgainstRegistry } from "./validate/validate-against-registry";

export type SearchParams = Record<string, string | string[] | undefined>;

export type ResolvePageResult =
  | { status: "not-found" }
  | { status: "invalid"; errors: string[] }
  | { status: "ok"; node: ReactNode; page: PageConfigFile };

/** Base plus whatever a connector's `components` extension point contributed
 * (`config/contributed-components.ts`, empty in `alaiy_os`) - computed once
 * at module scope, not per request, since both inputs are static for the
 * lifetime of the server process. */
const effectiveComponentRegistry = mergeRegistries(baseComponentRegistry, contributedComponents);

/**
 * The one pipeline every `/os/*` route calls: resolve a page id through the
 * current `UIPageStore`, resolve whatever data sources its definition
 * references (via the Data Source Registry - `resolvePageData`), and render
 * through `UIRenderer` (or that page's `pageFeatures` render override, if
 * any). A missing config and an invalid one are reported distinctly - the
 * caller decides how to present each, but neither one ever throws past this
 * function into a raw error boundary with a stack trace.
 */
export async function resolvePage(id: string, searchParams: SearchParams): Promise<ResolvePageResult> {
  let config: PageConfigFile | null;
  try {
    config = await getPageStore().getPageById(id);
  } catch (error) {
    if (error instanceof InvalidPageConfigError) return { status: "invalid", errors: error.errors };
    throw error;
  }

  if (!config) return { status: "not-found" };

  const registry = effectiveComponentRegistry;

  const registryErrors = validateAgainstRegistry(config, {
    componentRegistry: registry,
    isDataSourceRegistered: (id) => getDataSource(id) !== undefined,
  });
  if (registryErrors.length > 0) return { status: "invalid", errors: registryErrors };

  const data = await resolvePageData(config.definition, { searchParams });
  const binding = pageFeatures[config.id];

  const node = binding?.render ? (
    binding.render(config.definition, data, registry)
  ) : (
    <UIRenderer definition={config.definition} data={data} registry={registry} />
  );

  return { status: "ok", node, page: config };
}
