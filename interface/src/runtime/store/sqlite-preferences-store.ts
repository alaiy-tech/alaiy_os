// Server-only: opens the same `interface/public/headless-os.sqlite` file
// `sqlite-page-store.ts`/`sqlite-sidebar-store.ts` do, via its own
// `DatabaseSync` connection to that path - a third table in the same file,
// not a shared connection, following those files' own constructor pattern
// exactly (default-param `dbPath`, private handle, `createSchema` run in the
// constructor).

import { PREFERENCE_KEYS, type PreferenceKey, type PreferenceValueMap } from "@/lib/preferences/preferences-config";
import type { PreferencesStore } from "@/types/runtime/store";

import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = path.join(process.cwd(), "public", "headless-os.sqlite");

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

type PreferenceRow = { key: string; value: string };

export function createSchema(db: DatabaseSync): void {
  db.exec(SCHEMA);
}

const KNOWN_KEYS: ReadonlySet<string> = new Set(PREFERENCE_KEYS);

/**
 * Reads/writes the local SQLite `preferences` table - one shared row per
 * key (see `types/runtime/store.ts`'s `PreferencesStore` doc comment for
 * why this is global rather than per-user). No seed step, unlike
 * `SQLiteSidebarStore`: an empty table is the normal starting state, and a
 * missing key just falls back to `PREFERENCE_DEFAULTS` at the caller's
 * `parsePreference` step.
 */
export class SQLitePreferencesStore implements PreferencesStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string = DB_PATH) {
    this.db = new DatabaseSync(dbPath);
    createSchema(this.db);
  }

  async getPreferences(): Promise<Partial<PreferenceValueMap>> {
    const rows = this.db.prepare("SELECT key, value FROM preferences").all() as PreferenceRow[];
    const values: Partial<PreferenceValueMap> = {};
    for (const row of rows) {
      if (KNOWN_KEYS.has(row.key)) {
        values[row.key as PreferenceKey] = row.value as never;
      }
    }
    return values;
  }

  async setPreference<K extends PreferenceKey>(key: K, value: PreferenceValueMap[K]): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, value, now);
  }
}

let store: PreferencesStore | null = null;

/** The single place the rest of the app asks for "the current preferences
 * store" - swapping `SQLitePreferencesStore` for a future
 * `FrappePreferencesStore` is a one-line change here. */
export function getPreferencesStore(): PreferencesStore {
  store ??= new SQLitePreferencesStore();
  return store;
}
