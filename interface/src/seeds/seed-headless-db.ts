/**
 * Script: seed-headless-db.ts
 *
 * Forces a fresh seed of the local Headless OS SQLite database
 * (interface/public/headless-os.sqlite). The store already auto-seeds an
 * empty database the first time it's opened (see
 * src/runtime/store/sqlite-page-store.ts's `ensureSeeded`) - a fresh
 * clone works with just `pnpm dev`, no manual step required. This script is
 * only for explicitly forcing a *reseed* during development, e.g. after
 * editing `src/seeds/pages/seed-data.ts`.
 *
 * Deliberately doesn't re-import the seed data/schema modules directly:
 * those import through this app's `@/*` path alias, which Next.js's own
 * bundler resolves but plain `ts-node` (how this script runs, per
 * `tsconfig.scripts.json`) does not. Instead this just deletes the database
 * file - the next request `next dev`/`next start` serves reopens the store,
 * finds an empty table, and re-seeds it automatically through the app's own
 * module resolution, where the alias works fine.
 *
 * Usage:
 *   npm run seed:headless-db
 */

import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(__dirname, "../../public/headless-os.sqlite");

if (fs.existsSync(dbPath)) {
  fs.rmSync(dbPath);
  console.log(`Deleted ${dbPath} - it will be reseeded the next time the app starts.`);
} else {
  console.log(`${dbPath} doesn't exist yet - it will be seeded the next time the app starts.`);
}
