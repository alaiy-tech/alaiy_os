/** A reference to a named, page-registered data source, with an optional
 * dot-path reaching into it. `source` names a top-level key of whatever
 * object a feature's own data-shaping step produced (e.g. "recentOrders",
 * "kpis", "salesTrend") - never a raw dot-path into one flat, page-specific
 * blob. `path`, when present, reaches one field out of a richer source
 * (`{ source: "salesTrend", path: "points" }`); omitted, the whole source is
 * used as-is (`{ source: "recentOrders" }` when that source already IS the
 * array a component needs). */
export type DataSourceRef = { source: string; path?: string };
