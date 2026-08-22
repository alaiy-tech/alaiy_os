import { beforeEach, describe, expect, it } from "vitest";

import { getDataSource, listDataSources, registerDataSource } from "@/runtime/data/registry";
import { resolvePageData } from "@/runtime/data/resolver";
import type { UIPageDefinition } from "@/types/runtime/page";

function page(children: UIPageDefinition["children"]): UIPageDefinition {
  return { id: "test-page", kind: "page", children };
}

describe("Data Source Registry", () => {
  it("registers and resolves a source by id", () => {
    registerDataSource({
      id: "test.widgets",
      description: "Test widgets",
      capabilities: { list: true },
      fields: [{ name: "name", label: "Name", type: "string" }],
      async resolve() {
        return [{ name: "a" }];
      },
    });

    const source = getDataSource("test.widgets");
    expect(source).toBeDefined();
    expect(source?.description).toBe("Test widgets");
  });

  it("returns undefined for an unregistered id, without throwing", () => {
    expect(() => getDataSource("does-not-exist")).not.toThrow();
    expect(getDataSource("does-not-exist")).toBeUndefined();
  });

  it("exposes capability metadata via listDataSources - the AI-discoverable contract", () => {
    registerDataSource({
      id: "test.capabilities",
      description: "Has a full capability set",
      capabilities: { list: true, search: true, filter: true, sort: true, pagination: true },
      fields: [{ name: "id", label: "ID", type: "string" }],
      async resolve() {
        return [];
      },
    });

    const found = listDataSources().find((source) => source.id === "test.capabilities");
    expect(found?.capabilities).toEqual({ list: true, search: true, filter: true, sort: true, pagination: true });
    expect(found?.fields).toEqual([{ name: "id", label: "ID", type: "string" }]);
  });
});

describe("resolvePageData", () => {
  beforeEach(() => {
    registerDataSource({
      id: "test.rows",
      description: "Some rows",
      capabilities: {},
      fields: [],
      async resolve() {
        return [{ id: 1 }, { id: 2 }];
      },
    });
    registerDataSource({
      id: "test.single",
      description: "A single value",
      capabilities: {},
      fields: [],
      async resolve() {
        return { count: 42 };
      },
    });
  });

  it("resolves only the sources a definition actually references, keyed by source id (not by the binding's prop name)", async () => {
    const definition = page([
      { id: "table", kind: "component", type: "os-data-table", data: { rows: { source: "test.rows" } } },
    ]);

    const data = await resolvePageData(definition, { searchParams: {} });
    expect(data).toEqual({ "test.rows": [{ id: 1 }, { id: 2 }] });
  });

  it("resolves multiple distinct sources found across nested layout/component nodes", async () => {
    const definition = page([
      {
        id: "row",
        kind: "layout",
        type: "grid",
        children: [
          { id: "kpi", kind: "component", type: "os-kpi", data: { value: { source: "test.single", path: "count" } } },
          { id: "table", kind: "component", type: "os-data-table", data: { rows: { source: "test.rows" } } },
        ],
      },
    ]);

    const data = await resolvePageData(definition, { searchParams: {} });
    expect(data).toEqual({ "test.single": { count: 42 }, "test.rows": [{ id: 1 }, { id: 2 }] });
  });

  it("an unregistered source id resolves to undefined rather than throwing", async () => {
    const definition = page([
      { id: "table", kind: "component", type: "os-data-table", data: { rows: { source: "does-not-exist" } } },
    ]);

    const data = await resolvePageData(definition, { searchParams: {} });
    expect(data).toEqual({ "does-not-exist": undefined });
  });

  it("a definition with no data bindings resolves nothing", async () => {
    const definition = page([{ id: "header", kind: "component", type: "os-page-header", props: { title: "Hi" } }]);
    const data = await resolvePageData(definition, { searchParams: {} });
    expect(data).toEqual({});
  });
});
