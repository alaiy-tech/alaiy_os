// @vitest-environment node
//
// This file's whole point is exercising a Node builtin (`node:sqlite`) -
// the suite's default `jsdom` environment (set in vitest.config.ts, needed
// for every component test) can't bundle Node builtins at all, so this one
// file overrides back to the plain `node` environment.

import { describe, expect, it } from "vitest";

import { InvalidPageConfigError } from "@/runtime/store/invalid-page-config-error";
import {
  createSchema,
  SQLiteUIPageStore,
  upsertPage,
} from "@/runtime/store/sqlite-page-store";
import { SEED_PAGES } from "@/seeds/seed";
import type { PageConfigFile } from "@/types/runtime/page";

import { DatabaseSync } from "node:sqlite";

/** Every test uses `:memory:` - a real SQLite database with no filesystem
 * footprint, so these tests never touch `public/headless-os.sqlite` and
 * never collide with each other. */
function memoryStore(): SQLiteUIPageStore {
  return new SQLiteUIPageStore(":memory:");
}

const VALID_PAGE: PageConfigFile = {
  id: "test-page",
  route: "/os/test-page",
  metadata: { title: "Test Page" },
  definition: {
    id: "test-def",
    kind: "page",
    children: [
      {
        id: "header",
        kind: "component",
        type: "os-page-header",
        props: { title: "Test" },
      },
    ],
  },
};

describe("SQLiteUIPageStore", () => {
  it("initializes the schema and auto-seeds - a fresh store already has every seed page", async () => {
    const store = memoryStore();
    for (const seedPage of SEED_PAGES) {
      expect(await store.getPageById(seedPage.id)).not.toBeNull();
    }
  });

  it("independent :memory: stores never collide with each other or with the real file's sidebar singleton", async () => {
    // Regression test: `ensureSeeded` used to call `getSidebarStore()` with
    // no path, which always bound to the real `public/headless-os.sqlite`
    // singleton regardless of which database this store itself was using -
    // so a second :memory: store in the same process could crash against
    // state a first one (or a real dev server) had already left behind.
    expect(() => memoryStore()).not.toThrow();
    expect(() => memoryStore()).not.toThrow();

    const { getSidebarStore } =
      await import("@/runtime/store/sqlite-sidebar-store");
    expect(getSidebarStore(":memory:")).not.toBe(getSidebarStore(":memory:"));
  });

  it("auto-seeding is idempotent - re-opening an already-seeded database doesn't duplicate rows", async () => {
    const db = new DatabaseSync(":memory:");
    createSchema(db);
    // Simulate two store constructions against the same underlying database.
    const { ensureSeeded } = await import("@/runtime/store/sqlite-page-store");
    ensureSeeded(db, ":memory:");
    ensureSeeded(db, ":memory:");
    const row = db.prepare("SELECT COUNT(*) as count FROM ui_pages").get() as {
      count: number;
    };
    expect(row.count).toBe(SEED_PAGES.length);
  });

  it("creates and reads back a page by id and by route", async () => {
    const store = memoryStore();
    // biome-ignore lint/suspicious/noExplicitAny: test-only access to upsert a page directly against the store's own db.
    upsertPage((store as any).db, VALID_PAGE);

    const byId = await store.getPageById("test-page");
    expect(byId?.route).toBe("/os/test-page");

    const byRoute = await store.getPageByRoute("/os/test-page");
    expect(byRoute?.id).toBe("test-page");
  });

  it("createPage writes a page reachable by both id and route", async () => {
    const store = memoryStore();
    await store.createPage(VALID_PAGE);

    expect((await store.getPageById("test-page"))?.route).toBe("/os/test-page");
    expect((await store.getPageByRoute("/os/test-page"))?.id).toBe("test-page");
  });

  it("returns null for a route/id with no page", async () => {
    const store = memoryStore();
    expect(await store.getPageById("does-not-exist")).toBeNull();
    expect(await store.getPageByRoute("/os/does-not-exist")).toBeNull();
  });

  it("treats a disabled page as not-found", async () => {
    const store = memoryStore();
    // biome-ignore lint/suspicious/noExplicitAny: test-only access to the store's own db.
    const db = (store as any).db as DatabaseSync;
    upsertPage(db, VALID_PAGE);
    db.prepare("UPDATE ui_pages SET is_enabled = 0 WHERE id = ?").run(
      "test-page",
    );

    expect(await store.getPageById("test-page")).toBeNull();
  });

  it("throws InvalidPageConfigError for a row whose definition_json fails schema validation", async () => {
    const store = memoryStore();
    // biome-ignore lint/suspicious/noExplicitAny: test-only access to the store's own db.
    const db = (store as any).db as DatabaseSync;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO ui_pages (id, route, title, definition_json, metadata_json, is_enabled, version, created_at, updated_at)
       VALUES (?, ?, NULL, ?, NULL, 1, 1, ?, ?)`,
    ).run(
      "broken",
      "/os/broken",
      JSON.stringify({ id: "broken-def", kind: "not-a-page" }),
      now,
      now,
    );

    await expect(store.getPageById("broken")).rejects.toBeInstanceOf(
      InvalidPageConfigError,
    );
  });

  it("upsertPage bumps version on update, and is otherwise idempotent", async () => {
    const store = memoryStore();
    // biome-ignore lint/suspicious/noExplicitAny: test-only access to the store's own db.
    const db = (store as any).db as DatabaseSync;
    upsertPage(db, VALID_PAGE);
    upsertPage(db, VALID_PAGE);

    const row = db
      .prepare("SELECT version FROM ui_pages WHERE id = ?")
      .get("test-page") as { version: number };
    expect(row.version).toBe(2);

    const count = db
      .prepare("SELECT COUNT(*) as count FROM ui_pages WHERE id = ?")
      .get("test-page") as {
      count: number;
    };
    expect(count.count).toBe(1);
  });

  it("listPages skips an individually invalid row rather than failing the whole listing", async () => {
    const store = memoryStore();
    // biome-ignore lint/suspicious/noExplicitAny: test-only access to the store's own db.
    const db = (store as any).db as DatabaseSync;
    upsertPage(db, VALID_PAGE);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO ui_pages (id, route, title, definition_json, metadata_json, is_enabled, version, created_at, updated_at)
       VALUES (?, ?, NULL, ?, NULL, 1, 1, ?, ?)`,
    ).run("broken", "/os/broken", "not json at all", now, now);

    const pages = await store.listPages();
    const ids = pages.map((page) => page.id);
    expect(ids).toContain("test-page");
    expect(ids).not.toContain("broken");
  });
});
