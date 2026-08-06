/**
 * Forces a fresh seed of the local Headless OS SQLite database
 * (interface/public/headless-os.sqlite). The store already auto-seeds an
 * empty database on first open (`sqlite-page-store.ts`'s `ensureSeeded`),
 * so this is only for forcing a *reseed* during development, e.g. after
 * editing `src/seeds/seed.ts`.
 *
 * Just deletes the database file rather than re-running the seed data
 * directly - `seeds/seed.ts` uses `@/*` aliases that plain ts-node (how this
 * script runs, per `tsconfig.scripts.json`) can't resolve, unlike Next's own
 * bundler. The next `next dev`/`next start` request reopens the store,
 * finds an empty table, and re-seeds through the app's own module
 * resolution instead.
 *
 * Usage: npm run seed:headless-db
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
