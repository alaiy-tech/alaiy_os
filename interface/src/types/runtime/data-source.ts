export type DataSourceFieldType = "string" | "number" | "boolean" | "date" | "currency";

export type DataSourceField = {
  name: string;
  label: string;
  type: DataSourceFieldType;
};

/** What a data source's `resolve()` has access to. Deliberately narrow -
 * today just the request's search params - rather than a generic "context
 * bag," so a source's dependency on the request is explicit and typed. */
export type DataSourceContext = {
  searchParams: Record<string, string | string[] | undefined>;
};

/**
 * The capability contract (brief §14): what a data source supports, not
 * whether the runtime enforces it yet - `resolvePageData` only ever calls
 * `resolve()`, it doesn't check `capabilities` before doing so. This exists
 * so the registry is genuinely introspectable (`listDataSources()` answers
 * "what exists, what can it do, what does it return" without reading source
 * code), which is the actual point of an AI-discoverable registry, without
 * building enforcement machinery nothing calls yet.
 */
export type DataSourceCapabilities = {
  list?: boolean;
  detail?: boolean;
  aggregate?: boolean;
  search?: boolean;
  filter?: boolean;
  sort?: boolean;
  pagination?: boolean;
};

export type DataSourceDefinition<TResult = unknown> = {
  id: string;
  description: string;
  capabilities: DataSourceCapabilities;
  fields: DataSourceField[];
  resolve: (context: DataSourceContext) => Promise<TResult>;
};

/** A reference to a data source, with an optional dot-path reaching into it.
 * Two shapes:
 *
 * - **`{ source, path? }`**: `source` is a named, registered Data Source
 *   Registry id (e.g. `"dashboard.greeting"`) - for domain-specific sources
 *   with real business logic that doesn't fit a declarative `DataDefinition`
 *   (see `runtime/registry/data-source-registry.ts`).
 * - **`{ ref, path? }`**: references a *named* entry declared once in the
 *   page's own `UIPageDefinition.data` dict (`DataDefinition`,
 *   `types/runtime/data-definition.ts`) by name - the mechanism that lets
 *   two different bindings (e.g. a table's `rows` and its `pagination`)
 *   share one resolved definition without duplicating it or triggering a
 *   second resolve.
 *
 * `path`, when present, reaches one field out of a richer resolved value
 * (`{ ref: "customers", path: "rows" }` to pull just the row array out of a
 * resolved `DataDefinition`); omitted, the whole resolved value is used
 * as-is. */
export type DataSourceRef = { source: string; path?: string } | { ref: string; path?: string };
