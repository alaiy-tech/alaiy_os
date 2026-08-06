// Server-only: opens the same `interface/public/headless-os.sqlite` file
// `sqlite-page-store.ts` does, via its own `DatabaseSync` connection to that
// path - two tables in one file, not a shared connection, following that
// file's own constructor pattern exactly (default-param `dbPath`, private
// handle, `createSchema` + a sync step run in the constructor).

import { buildCodeDefinedSidebar } from "@/seeds/seed";
import type {
  SidebarNavGroupData,
  SidebarNavItemData,
} from "@/types/navigation";
import type { DynamicPageEntry, SidebarStore } from "@/types/runtime/store";

import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = path.join(process.cwd(), "public", "headless-os.sqlite");

const UNCATEGORISED_GROUP_ID = "uncategorised";
const UNCATEGORISED_GROUP_LABEL = "Uncategorised";
/** No AI exists yet to pick something genuinely relevant to a page's
 * content - a neutral "this is a page" glyph, not a real heuristic. */
const DEFAULT_DYNAMIC_PAGE_ICON = "file-text";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sidebar_groups (
    id TEXT PRIMARY KEY,
    label TEXT,
    sort_order INTEGER NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('code','dynamic')),
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sidebar_items (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES sidebar_groups(id),
    parent_item_id TEXT REFERENCES sidebar_items(id),
    title TEXT NOT NULL,
    url TEXT,
    icon TEXT,
    badge TEXT CHECK (badge IN ('new','soon')),
    disabled INTEGER NOT NULL DEFAULT 0,
    new_tab INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL,
    page_id TEXT,
    source TEXT NOT NULL CHECK (source IN ('code','dynamic')),
    updated_at TEXT NOT NULL
  );
`;

type SidebarGroupRow = {
  id: string;
  label: string | null;
  sort_order: number;
  source: string;
};

type SidebarItemRow = {
  id: string;
  group_id: string;
  parent_item_id: string | null;
  title: string;
  url: string | null;
  icon: string | null;
  badge: string | null;
  disabled: number;
  new_tab: number;
  sort_order: number;
  page_id: string | null;
  source: string;
};

export function createSchema(db: DatabaseSync): void {
  db.exec(SCHEMA);
}

function insertGroup(
  db: DatabaseSync,
  group: SidebarNavGroupData,
  index: number,
  now: string,
): void {
  db.prepare(
    `INSERT INTO sidebar_groups (id, label, sort_order, source, updated_at) VALUES (?, ?, ?, 'code', ?)`,
  ).run(group.id, group.label ?? null, index, now);
}

function insertItem(
  db: DatabaseSync,
  item: SidebarNavItemData,
  groupId: string,
  parentItemId: string | null,
  index: number,
  now: string,
): void {
  db.prepare(
    `INSERT INTO sidebar_items
       (id, group_id, parent_item_id, title, url, icon, badge, disabled, new_tab, sort_order, page_id, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'code', ?)`,
  ).run(
    item.id,
    groupId,
    parentItemId,
    item.title,
    item.url,
    item.icon ?? null,
    item.badge ?? null,
    item.disabled ? 1 : 0,
    item.newTab ? 1 : 0,
    index,
    now,
  );

  item.subItems?.forEach((sub, subIndex) => {
    insertItem(db, sub, groupId, item.id, subIndex, now);
  });
}

/**
 * Replaces every `source = 'code'` row with a fresh copy of
 * `buildCodeDefinedSidebar()` - run unconditionally on every store
 * construction (unlike `ui_pages`' seed-once `ensureSeeded`), because the
 * base's own groups and connector contributions
 * (`config/contributed-nav.ts`) are still code-owned config: a redeploy
 * that changes either must take effect without a manual reseed step. Rows
 * with `source = 'dynamic'` (a future manually- or Ask-Alaiy-created page's
 * nav entry) are never touched here.
 */
export function syncCodeDefinedSidebar(db: DatabaseSync): void {
  const now = new Date().toISOString();
  // Deletes every item *belonging to* a code-owned group, not just items
  // whose own `source` happens to say 'code' - `sidebar_items.group_id`
  // is a NOT NULL FK into `sidebar_groups`, so any leftover row still
  // pointing at a group this resync is about to remove (e.g. historical
  // data from before a baseline reset, or a stale row inserted under a
  // group id that no longer exists in the current seed) would otherwise
  // fail the DELETE below with a FOREIGN KEY constraint error instead of
  // being cleaned up. A correctly-tagged dynamic item is never inserted
  // under a code group (`ensureDynamicPageEntry` only ever targets the
  // dynamic "Uncategorised" group), so this can't delete anything that
  // should have survived.
  db.exec(
    "DELETE FROM sidebar_items WHERE group_id IN (SELECT id FROM sidebar_groups WHERE source = 'code')",
  );
  db.exec("DELETE FROM sidebar_groups WHERE source = 'code'");

  const groups = buildCodeDefinedSidebar();
  groups.forEach((group, groupIndex) => {
    insertGroup(db, group, groupIndex, now);
    group.items.forEach((item, itemIndex) => {
      insertItem(db, item, group.id, null, itemIndex, now);
    });
  });
}

function nextSortOrder(
  db: DatabaseSync,
  table: "sidebar_groups" | "sidebar_items",
  groupId?: string,
): number {
  const row =
    table === "sidebar_items"
      ? (db
          .prepare(
            "SELECT MAX(sort_order) as maxOrder FROM sidebar_items WHERE group_id = ?",
          )
          .get(groupId) as {
          maxOrder: number | null;
        })
      : (db
          .prepare("SELECT MAX(sort_order) as maxOrder FROM sidebar_groups")
          .get() as { maxOrder: number | null });
  return (row.maxOrder ?? -1) + 1;
}

/** Creates the "Uncategorised" group (`source: 'dynamic'`) the first time a
 * dynamic page entry needs it. A no-op every call after that. */
function ensureUncategorisedGroup(db: DatabaseSync, now: string): void {
  const existing = db
    .prepare("SELECT id FROM sidebar_groups WHERE id = ?")
    .get(UNCATEGORISED_GROUP_ID);
  if (existing) return;

  db.prepare(
    `INSERT INTO sidebar_groups (id, label, sort_order, source, updated_at) VALUES (?, ?, ?, 'dynamic', ?)`,
  ).run(
    UNCATEGORISED_GROUP_ID,
    UNCATEGORISED_GROUP_LABEL,
    nextSortOrder(db, "sidebar_groups"),
    now,
  );
}

function rowToItemData(row: SidebarItemRow): SidebarNavItemData {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    icon: row.icon ?? undefined,
    badge: row.badge === "new" || row.badge === "soon" ? row.badge : undefined,
    disabled: row.disabled === 1,
    newTab: row.new_tab === 1,
  };
}

function nestItems(items: SidebarItemRow[]): SidebarNavItemData[] {
  const byParent = new Map<string | null, SidebarItemRow[]>();
  for (const row of items) {
    const key = row.parent_item_id;
    const bucket = byParent.get(key) ?? [];
    bucket.push(row);
    byParent.set(key, bucket);
  }

  function build(parentId: string | null): SidebarNavItemData[] {
    const rows = byParent.get(parentId) ?? [];
    return rows.map((row) => {
      const data = rowToItemData(row);
      const children = build(row.id);
      return children.length > 0 ? { ...data, subItems: children } : data;
    });
  }

  return build(null);
}

/**
 * Reads the `/os/*` sidebar from the local SQLite `sidebar_groups`/`sidebar_items`
 * tables (same file as `SQLiteUIPageStore`). See `sidebar-store.ts` for why
 * this is behind an interface, and `seeds/seed.ts`/`syncCodeDefinedSidebar`
 * above for how `source = 'code'` rows stay in sync with that seed and
 * `contributed-nav.ts`.
 */
export class SQLiteSidebarStore implements SidebarStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string = DB_PATH) {
    this.db = new DatabaseSync(dbPath);
    createSchema(this.db);
    syncCodeDefinedSidebar(this.db);
  }

  async getSidebarNav(): Promise<SidebarNavGroupData[]> {
    const groupRows = this.db
      .prepare("SELECT * FROM sidebar_groups ORDER BY sort_order")
      .all() as SidebarGroupRow[];
    const itemRows = this.db
      .prepare("SELECT * FROM sidebar_items ORDER BY sort_order")
      .all() as SidebarItemRow[];

    return groupRows.map((group) => ({
      id: group.id,
      label: group.label ?? undefined,
      items: nestItems(itemRows.filter((item) => item.group_id === group.id)),
    }));
  }

  async ensureDynamicPageEntry(entry: DynamicPageEntry): Promise<void> {
    const existing = this.db
      .prepare("SELECT id FROM sidebar_items WHERE page_id = ?")
      .get(entry.pageId);
    if (existing) return;

    const now = new Date().toISOString();
    ensureUncategorisedGroup(this.db, now);

    this.db
      .prepare(
        `INSERT INTO sidebar_items
           (id, group_id, parent_item_id, title, url, icon, badge, disabled, new_tab, sort_order, page_id, source, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, NULL, 0, 0, ?, ?, 'dynamic', ?)`,
      )
      .run(
        entry.pageId,
        UNCATEGORISED_GROUP_ID,
        entry.title,
        entry.url,
        entry.icon ?? DEFAULT_DYNAMIC_PAGE_ICON,
        nextSortOrder(this.db, "sidebar_items", UNCATEGORISED_GROUP_ID),
        entry.pageId,
        now,
      );
  }
}

let store: SidebarStore | null = null;

/** The single place the rest of the app asks for "the current sidebar
 * store" - swapping `SQLiteSidebarStore` for a future `FrappeSidebarStore`
 * is a one-line change here. Cached only for the default (real-file) path,
 * matching production usage where one long-lived connection is desirable.
 * Any other `dbPath` - a test's own `:memory:` database, passed through by
 * `sqlite-page-store.ts`'s `ensureSeeded` - always gets a fresh, uncached
 * instance instead: caching by the bare default would silently bind every
 * caller to the real on-disk file regardless of which database it actually
 * meant, which is what used to make every `:memory:` `SQLiteUIPageStore`
 * test leak dynamic sidebar entries into `public/headless-os.sqlite`. */
export function getSidebarStore(dbPath: string = DB_PATH): SidebarStore {
  if (dbPath === DB_PATH) {
    store ??= new SQLiteSidebarStore(dbPath);
    return store;
  }
  return new SQLiteSidebarStore(dbPath);
}
