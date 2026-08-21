/** Importing this module registers every data source as a side effect
 * (each `sources/*.ts` file calls `registerDataSource` at module load time).
 * `resolvePageData`'s caller imports this once so every source is available
 * before the first `resolvePageData` call - the registry itself stays a
 * plain `Map` with no built-in discovery/auto-import mechanism, since a
 * one-line import list is simpler than a filesystem-scanning loader for the
 * two sources that exist today. */
import "./dashboard";
import "./customers";
