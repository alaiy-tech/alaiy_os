import type { DataSourceDefinition } from "@/types/runtime/data-source";

/**
 * The Data Source Registry: the abstraction boundary between a UI
 * Definition's `data` bindings and the existing Frappe BFF
 * (`src/lib/frappe/`). A page's JSON only ever references a source `id`
 * (e.g. `"customers"`, `"dashboard.overview"`) - never a Frappe method path,
 * SQL, or an arbitrary function name. What that id actually does to fetch
 * data lives in `sources/*.ts`, each calling the *existing, unmodified*
 * fetchers under `src/lib/frappe/` - this registry doesn't talk to Frappe
 * itself, it only knows what's registered and hands back whichever
 * `resolve()` a caller asks for by id.
 */
// biome-ignore lint/suspicious/noExplicitAny: the registry deliberately holds sources with unrelated result types.
const sources = new Map<string, DataSourceDefinition<any>>();

export function registerDataSource(definition: DataSourceDefinition): void {
  sources.set(definition.id, definition);
}

export function getDataSource(id: string): DataSourceDefinition | undefined {
  return sources.get(id);
}

export function listDataSources(): DataSourceDefinition[] {
  return [...sources.values()];
}
