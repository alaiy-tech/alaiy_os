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
