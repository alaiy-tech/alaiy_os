import type { PreferenceKey, PreferenceValueMap } from "@/lib/preferences/preferences-config";

import type { SidebarNavGroupData } from "../navigation";
import type { PageConfigFile } from "./page";

/**
 * Where page definitions come from. Today there's exactly one implementation
 * (`SQLiteUIPageStore`); a future `FrappePageStore` implements the same
 * three methods against a database table instead, and nothing above this
 * interface - the dynamic route, `resolve-page.tsx`, the renderer - needs to
 * change to use it.
 */
export interface UIPageStore {
  /** `route` is the full path, e.g. `"/os"` or `"/os/customers"`. */
  getPageByRoute(route: string): Promise<PageConfigFile | null>;
  /** `id` is the page's own `id` field (also used as its on-disk/DB key). */
  getPageById(id: string): Promise<PageConfigFile | null>;
  listPages(): Promise<PageConfigFile[]>;
  /** Insert-or-update a page by id. A thin wrapper most callers should
   * reach through `runtime/store/create-page.ts`'s `createPageWithSidebarEntry`
   * instead of calling directly - that also creates the page's sidebar
   * entry, which this method alone does not. */
  createPage(page: PageConfigFile): Promise<void>;
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
  /** Ensures a dynamic (`source: 'dynamic'`) sidebar entry exists for a
   * page, under the "Uncategorised" group - creating that group on first
   * use. Idempotent by `pageId`: a second call for the same page is a
   * no-op, not a duplicate row. The primitive `runtime/store/create-page.ts`'s
   * `createPageWithSidebarEntry` builds on - see that file for why a page
   * and its sidebar entry are created together. */
  ensureDynamicPageEntry(entry: DynamicPageEntry): Promise<void>;
}

export type DynamicPageEntry = {
  pageId: string;
  title: string;
  url: string;
  /** Lucide icon name, lower-kebab-case. Falls back to a generic
   * placeholder when omitted - there's no AI yet to pick something
   * genuinely relevant to the page's content. */
  icon?: string;
};

/**
 * Where user preferences (theme, layout, sidebar variant, ...) are stored -
 * one shared row per key, not per user or per browser (a deliberate
 * decision: this deployment's preferences are global, the same choice
 * `SQLiteSidebarStore`'s `source = 'code'` rows made for base sidebar
 * config) - the only source of truth for a preference's value. Raw and
 * unvalidated: a missing key or a value that's since fallen out of a
 * preference's allowed set is the caller's job to fall back on via
 * `parsePreference` (`lib/preferences/preferences-config.ts`), which
 * `server-actions.ts`'s `getPreference`/`getAllPreferences` already apply.
 */
export interface PreferencesStore {
  getPreferences(): Promise<Partial<PreferenceValueMap>>;
  setPreference<K extends PreferenceKey>(key: K, value: PreferenceValueMap[K]): Promise<void>;
}
