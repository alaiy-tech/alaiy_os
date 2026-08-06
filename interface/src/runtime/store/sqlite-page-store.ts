// Server-only: opens interface/public/headless-os.sqlite via Node's built-in
// `node:sqlite` module. Never import this from a "use client" module - same
// convention as src/lib/frappe/server.ts (documented, not enforced by a
// "server-only" package dependency - Node builtins simply don't exist in a
// browser bundle, so Next's bundler already refuses to ship this into client
// code).
//
// Deployment note: `node:sqlite` is still labeled an experimental Node API
// (stable without a flag on the Node version this repo runs, v22.21.0, but
// its own docs reserve the right to change). That risk is isolated to this
// one file by the `UIPageStore` interface - swapping to `better-sqlite3` (a
// native dependency) or a future `FrappeUIPageStore` is a change here only.

import { SEED_PAGES } from "@/seeds/pages/seed-data";
import type { PageConfigFile } from "@/types/runtime/page-config";
import type { UIPageStore } from "@/types/runtime/store";

import { validatePageConfig } from "../validate/validate";
import { InvalidPageConfigError } from "./invalid-page-config-error";
import { getSidebarStore } from "./sqlite-sidebar-store";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = path.join(process.cwd(), "public", "headless-os.sqlite");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS ui_pages (
    id TEXT PRIMARY KEY,
    route TEXT NOT NULL UNIQUE,
    title TEXT,
    definition_json TEXT NOT NULL,
    metadata_json TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

type UiPageRow = {
  id: string;
  route: string;
  title: string | null;
  definition_json: string;
  metadata_json: string | null;
  is_enabled: number;
  version: number;
  created_at: string;
  updated_at: string;
};

export function createSchema(db: DatabaseSync): void {
  db.exec(SCHEMA);
}

/** Insert-or-update a page by id, bumping `version` on every update. Used
 * both by `ensureSeeded` (first-run auto-seed) and `seeds/seed-headless-db.ts`
 * (explicit reseed after editing `seeds/pages/seed-data.ts`) - the same
 * idempotent operation either way. */
export function upsertPage(db: DatabaseSync, page: PageConfigFile): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO ui_pages (id, route, title, definition_json, metadata_json, is_enabled, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       route = excluded.route,
       title = excluded.title,
       definition_json = excluded.definition_json,
       metadata_json = excluded.metadata_json,
       updated_at = excluded.updated_at,
       version = version + 1`,
  ).run(
    page.id,
    page.route,
    page.metadata?.title ?? null,
    JSON.stringify(page.definition),
    page.metadata ? JSON.stringify(page.metadata) : null,
    now,
    now,
  );
}

/** Icons picked by hand for the two known seed pages - unlike a page
 * created through `createPageWithSidebarEntry` later, these are genuinely
 * relevant, not the generic fallback. */
const SEED_PAGE_ICONS: Record<string, string> = {
  dashboard: "layout-dashboard",
  customers: "users",
  "headless-data-test": "database",
};

/** Seeds the two Headless OS pages if the table is empty - a fresh clone
 * works with just `pnpm dev`, no manual step required. A no-op (not an
 * error) if pages already exist, so it's safe to call unconditionally on
 * every store construction. Also ensures each seed page has a dynamic
 * "Uncategorised" sidebar entry (`ensureDynamicPageEntry` is itself
 * idempotent, so this is safe to run every time regardless).
 *
 * `dbPath` is threaded through to `getSidebarStore` so a caller using a
 * non-default database (every unit test's `:memory:` `SQLiteUIPageStore`)
 * gets a sidebar store bound to that same database instead of silently
 * falling back to the real on-disk file's singleton. */
export function ensureSeeded(db: DatabaseSync, dbPath: string = DB_PATH): void {
  const row = db.prepare("SELECT COUNT(*) as count FROM ui_pages").get() as { count: number };
  if (row.count === 0) {
    for (const page of SEED_PAGES) upsertPage(db, page);
  }

  const sidebarStore = getSidebarStore(dbPath);
  for (const page of SEED_PAGES) {
    void sidebarStore.ensureDynamicPageEntry({
      pageId: page.id,
      title: page.metadata?.title ?? page.id,
      url: page.route,
      icon: SEED_PAGE_ICONS[page.id],
    });
  }
}

function rowToConfig(row: UiPageRow): PageConfigFile {
  const json = {
    id: row.id,
    route: row.route,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    definition: JSON.parse(row.definition_json),
  };

  const result = validatePageConfig(json);
  if (result.ok === false) throw new InvalidPageConfigError(result.errors);
  return result.page;
}

/**
 * Reads page definitions from the local `ui_pages` SQLite table
 * (`interface/public/headless-os.sqlite`) - the current runtime
 * configuration store, replacing Round 3's `JsonFilePageStore` (moved to
 * `obsolete/`). A future `FrappePageStore` implements `UIPageStore` against
 * a database table on the Frappe side instead - nothing above this
 * interface (the dynamic route, `resolve-page.tsx`, the renderer) changes
 * either way.
 */
export class SQLiteUIPageStore implements UIPageStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string = DB_PATH) {
    this.db = new DatabaseSync(dbPath);
    createSchema(this.db);
    ensureSeeded(this.db, dbPath);
  }

  async getPageById(id: string): Promise<PageConfigFile | null> {
    const row = this.db.prepare("SELECT * FROM ui_pages WHERE id = ? AND is_enabled = 1").get(id) as
      | UiPageRow
      | undefined;
    return row ? rowToConfig(row) : null;
  }

  async getPageByRoute(route: string): Promise<PageConfigFile | null> {
    const row = this.db.prepare("SELECT * FROM ui_pages WHERE route = ? AND is_enabled = 1").get(route) as
      | UiPageRow
      | undefined;
    return row ? rowToConfig(row) : null;
  }

  async listPages(): Promise<PageConfigFile[]> {
    const rows = this.db.prepare("SELECT * FROM ui_pages WHERE is_enabled = 1").all() as UiPageRow[];
    const pages: PageConfigFile[] = [];
    for (const row of rows) {
      try {
        pages.push(rowToConfig(row));
      } catch {
        // an individually invalid row shouldn't fail the whole listing
      }
    }
    return pages;
  }

  async createPage(page: PageConfigFile): Promise<void> {
    upsertPage(this.db, page);
  }
}

let store: UIPageStore | null = null;

/** The single place the rest of the app asks for "the current page store" -
 * swapping `SQLiteUIPageStore` for a future `FrappePageStore` is a one-line
 * change here. */
export function getPageStore(): UIPageStore {
  if (!store) store = new SQLiteUIPageStore();
  return store;
}
