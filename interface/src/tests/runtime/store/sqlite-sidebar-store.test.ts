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
  it("initializes the schema and syncs the code-defined baseline sidebar on construction", async () => {
    const store = memoryStore();
    const groups = await store.getSidebarNav();

    const os = groups.find((group) => group.id === "os");
    expect(os?.items.map((item) => item.id)).toEqual(["ask-alaiy"]);

    const askAlaiy = os?.items.find((item) => item.id === "ask-alaiy");
    expect(askAlaiy?.url).toBe("/os/ask-alaiy");
    expect(askAlaiy?.icon).toBe("sparkles");

    const settings = groups.find((group) => group.id === "settings");
    expect(settings?.label).toBeUndefined();
    expect(settings?.items.map((item) => item.id)).toEqual(["settings-link"]);
    expect(settings?.items[0]?.url).toBe("/settings");
  });

  it("re-syncing (e.g. a second store construction against the same database) doesn't duplicate code rows", () => {
    const db = new DatabaseSync(":memory:");
    createSchema(db);
    syncCodeDefinedSidebar(db);
    syncCodeDefinedSidebar(db);

    const groupCount = db.prepare("SELECT COUNT(*) as count FROM sidebar_groups").get() as { count: number };
    const itemCount = db.prepare("SELECT COUNT(*) as count FROM sidebar_items").get() as { count: number };

    // Sanity: exactly the 2 baseline groups, no duplicates.
    expect(groupCount.count).toBe(2);
    const askAlaiyCount = db.prepare("SELECT COUNT(*) as count FROM sidebar_items WHERE id = ?").get("ask-alaiy") as {
      count: number;
    };
    expect(askAlaiyCount.count).toBe(1);
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
    expect(codeGroupCount.count).toBe(2);
  });

  describe("ensureDynamicPageEntry", () => {
    it("creates the Uncategorised group and a dynamic item on first call", async () => {
      const store = memoryStore();
      await store.ensureDynamicPageEntry({ pageId: "my-page", title: "My Page", url: "/os/my-page" });

      const groups = await store.getSidebarNav();
      const uncategorised = groups.find((group) => group.id === "uncategorised");
      expect(uncategorised?.label).toBe("Uncategorised");
      expect(uncategorised?.items).toHaveLength(1);
      expect(uncategorised?.items[0]).toMatchObject({ id: "my-page", title: "My Page", url: "/os/my-page" });
    });

    it("is idempotent - a second call for the same pageId does not duplicate the entry", async () => {
      const store = memoryStore();
      await store.ensureDynamicPageEntry({ pageId: "my-page", title: "My Page", url: "/os/my-page" });
      await store.ensureDynamicPageEntry({ pageId: "my-page", title: "My Page", url: "/os/my-page" });

      const groups = await store.getSidebarNav();
      const uncategorised = groups.find((group) => group.id === "uncategorised");
      expect(uncategorised?.items).toHaveLength(1);
    });

    it("falls back to a generic icon when none is given, but keeps a caller-supplied one", async () => {
      const store = memoryStore();
      await store.ensureDynamicPageEntry({ pageId: "no-icon-page", title: "No Icon Page", url: "/os/no-icon-page" });
      await store.ensureDynamicPageEntry({
        pageId: "icon-page",
        title: "Icon Page",
        url: "/os/icon-page",
        icon: "layout-dashboard",
      });

      const groups = await store.getSidebarNav();
      const uncategorised = groups.find((group) => group.id === "uncategorised");
      expect(uncategorised?.items.find((item) => item.id === "no-icon-page")?.icon).toBe("file-text");
      expect(uncategorised?.items.find((item) => item.id === "icon-page")?.icon).toBe("layout-dashboard");
    });
  });
});
