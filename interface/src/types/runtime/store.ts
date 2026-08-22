import type { PreferenceKey, PreferenceValueMap } from "@/lib/preferences/preferences-config";

import type { SidebarNavGroupData } from "../navigation";
import type { PageConfigFile } from "./page-config";

/**
 * Where page definitions come from. Today there's exactly one implementation
 * (`SQLiteUIPageStore`); a future `FrappePageStore` implements the same
 * three methods against a database table instead, and nothing above this
 * interface - the dynamic route, `resolve-page.tsx`, the renderer - needs to
 * change to use it.
 */
export interface UIPageStore {
  /** `route` is the full path, e.g. `"/os/dashboard"`. */
  getPageByRoute(route: string): Promise<PageConfigFile | null>;
  /** `id` is the page's own `id` field (also used as its on-disk/DB key). */
  getPageById(id: string): Promise<PageConfigFile | null>;
  listPages(): Promise<PageConfigFile[]>;
}

/**
 * Where the `/os/*` sidebar's navigation comes from. One implementation
 * today (`SQLiteSidebarStore`) - a future `FrappeSidebarStore` implements
 * the same one method against a database table instead, and nothing above
 * this interface (`os/layout.tsx`, `AppSidebar`, `SearchDialog`) needs to
 * change either way.
 */
export interface SidebarStore {
  getSidebarNav(): Promise<SidebarNavGroupData[]>;
}

/**
 * Where user preferences (theme, layout, sidebar variant, ...) are stored -
 * one shared row per key, not per user or per browser (a deliberate
 * decision: this deployment's preferences are global, the same choice
 * `SQLiteSidebarStore`'s `source = 'code'` rows made for base sidebar
 * config). Raw and unvalidated: a missing key or a value that's since fallen
 * out of a preference's allowed set is the caller's job to fall back on via
 * `parsePreference` (`lib/preferences/preferences-config.ts`), the same
 * validation `server-actions.ts`'s `getPreference`/`getAllPreferences`
 * already apply to a cookie-sourced value today.
 */
export interface PreferencesStore {
  getPreferences(): Promise<Partial<PreferenceValueMap>>;
  setPreference<K extends PreferenceKey>(key: K, value: PreferenceValueMap[K]): Promise<void>;
}
