// @vitest-environment node
//
// Same reason as sqlite-page-store.test.ts: exercises `node:sqlite`, which
// the suite's default `jsdom` environment can't bundle.

import { describe, expect, it } from "vitest";

import { createSchema, SQLiteSidebarStore, syncCodeDefinedSidebar } from "@/runtime/store/sqlite-sidebar-store";

import { DatabaseSync } from "node:sqlite";

function memoryStore(): SQLiteSidebarStore {
  return new SQLiteSidebarStore(":memory:");
}

describe("SQLiteSidebarStore", () => {
  it("initializes the schema and syncs the code-defined sidebar on construction", async () => {
    const store = memoryStore();
    const groups = await store.getSidebarNav();

    const os = groups.find((group) => group.id === "os");
    expect(os).toBeDefined();
    expect(os?.items.map((item) => item.id)).toEqual(expect.arrayContaining(["ask-alaiy", "dashboard"]));

    const dashboard = os?.items.find((item) => item.id === "dashboard");
    expect(dashboard?.url).toBe("/os/dashboard");
    expect(dashboard?.icon).toBe("layout-dashboard");
  });

  it("nests sub-items under their parent via parent_item_id", async () => {
    const store = memoryStore();
    const groups = await store.getSidebarNav();

    const catalog = groups.find((group) => group.id === "catalog");
    const products = catalog?.items.find((item) => item.id === "products");
    expect(products?.url).toBeNull();
    expect(products?.subItems?.map((sub) => sub.id)).toEqual(["items", "item-groups", "brands", "attributes"]);
  });

  it("re-syncing (e.g. a second store construction against the same database) doesn't duplicate code rows", () => {
    const db = new DatabaseSync(":memory:");
    createSchema(db);
    syncCodeDefinedSidebar(db);
    syncCodeDefinedSidebar(db);

    const groupCount = db.prepare("SELECT COUNT(*) as count FROM sidebar_groups").get() as { count: number };
    const itemCount = db.prepare("SELECT COUNT(*) as count FROM sidebar_items").get() as { count: number };

    // Sanity: exactly the 5 base groups, no duplicates.
    expect(groupCount.count).toBe(5);
    const dashboardCount = db.prepare("SELECT COUNT(*) as count FROM sidebar_items WHERE id = ?").get("dashboard") as {
      count: number;
    };
    expect(dashboardCount.count).toBe(1);
    expect(itemCount.count).toBeGreaterThan(0);
  });

  it("a manually-inserted dynamic row survives a resync, while code rows are refreshed to match the seed", () => {
    const db = new DatabaseSync(":memory:");
    createSchema(db);
    syncCodeDefinedSidebar(db);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO sidebar_groups (id, label, sort_order, source, updated_at) VALUES (?, ?, ?, 'dynamic', ?)`,
    ).run("dynamic-group", "Dynamic", 99, now);
    db.prepare(
      `INSERT INTO sidebar_items
         (id, group_id, parent_item_id, title, url, icon, badge, disabled, new_tab, sort_order, page_id, source, updated_at)
       VALUES (?, ?, NULL, ?, ?, NULL, NULL, 0, 0, 0, ?, 'dynamic', ?)`,
    ).run("dynamic-item", "dynamic-group", "Dynamic Page", "/os/dynamic-page", "dynamic-page", now);

    syncCodeDefinedSidebar(db);

    const dynamicGroup = db.prepare("SELECT * FROM sidebar_groups WHERE id = ?").get("dynamic-group");
    const dynamicItem = db.prepare("SELECT * FROM sidebar_items WHERE id = ?").get("dynamic-item") as {
      page_id: string | null;
    };
    expect(dynamicGroup).toBeDefined();
    expect(dynamicItem).toBeDefined();
    expect(dynamicItem.page_id).toBe("dynamic-page");

    // Code-owned rows are still exactly the seeded set, not duplicated.
    const codeGroupCount = db.prepare("SELECT COUNT(*) as count FROM sidebar_groups WHERE source = 'code'").get() as {
      count: number;
    };
    expect(codeGroupCount.count).toBe(5);
  });
});
