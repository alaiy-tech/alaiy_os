import type { FrappeCountSourceConfig } from "./frappe-count";
import type { FrappeListSourceConfig } from "./frappe-list";

/** What a `{ source, path? }`-shaped `DataSourceRef` can hold - factored out
 * as its own named type (rather than accessed as `DataSourceRef["source"]`)
 * because `DataSourceRef` is now a union whose *other* member (`{ ref }`)
 * has no `source` property at all. */
export type DataSourceValue = string | FrappeListSourceConfig | FrappeCountSourceConfig;

/** A reference to a data source, with an optional dot-path reaching into it.
 * Two shapes:
 *
 * - **`{ source, path? }`**: `source` is either a **string** (a named,
 *   registered `Data Source Registry` id, e.g. `"customers"`,
 *   `"dashboard.salesTrend"` - the original, still-primary case for a
 *   domain-specific source with real business logic) or an **inline
 *   declarative config** (`FrappeListSourceConfig`/`FrappeCountSourceConfig`
 *   - a generic Frappe source described directly at this one binding, no
 *   registered id, dispatched by its own `type` field via
 *   `runtime/data/resolver.ts`'s `resolveSource`).
 * - **`{ ref, path? }`**: references a *named* entry declared once in the
 *   page's own `UIPageDefinition.data` dict (`types/runtime/page.ts`) by
 *   name - the mechanism that lets two different bindings (e.g. a table's
 *   `rows` and its `pagination`) share one resolved source without
 *   duplicating its config or triggering a second resolve. Not the same
 *   keyspace as `source`'s inline-config dedup (`sourceKey`) - see
 *   `page.ts`'s doc comment.
 *
 * `path`, when present, reaches one field out of a richer resolved value
 * (`{ source: "salesTrend", path: "points" }`, `{ ref: "customers", path: "data" }`
 * to pull just the row array out of a `FrappeListResult`); omitted, the
 * whole resolved value is used as-is. */
export type DataSourceRef = { source: DataSourceValue; path?: string } | { ref: string; path?: string };
