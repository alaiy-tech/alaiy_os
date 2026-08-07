import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDataSource, listDataSources, registerDataSource } from "@/runtime/data/registry";
import type { FrappeListSourceConfig } from "@/types/runtime/frappe-list";

const { frappeFetch } = vi.hoisted(() => ({ frappeFetch: vi.fn() }));
vi.mock("@/lib/frappe/server", () => ({ frappeFetch }));

const { buildFrappeListRequestPath, createFrappeListSource } = await import("@/runtime/data/frappe-list-resolver");

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function config(overrides: Partial<FrappeListSourceConfig> = {}): FrappeListSourceConfig {
  return {
    type: "frappe-list",
    id: "customers.list",
    description: "Customer roster",
    doctype: "Customer",
    fields: ["customer_name", "customer_group"],
    pagination: { pageSize: 2 },
    ...overrides,
  };
}

describe("buildFrappeListRequestPath", () => {
  it("encodes the doctype into the path", () => {
    const path = buildFrappeListRequestPath(config({ doctype: "Sales Order" }));
    expect(path.startsWith(`/api/resource/${encodeURIComponent("Sales Order")}?`)).toBe(true);
  });

  it("always includes 'name' in fields even when omitted from config", () => {
    const path = buildFrappeListRequestPath(config({ fields: ["customer_name"] }));
    const query = new URLSearchParams(path.split("?")[1]);
    const fields = JSON.parse(query.get("fields") ?? "[]");
    expect(fields).toContain("name");
    expect(fields).toContain("customer_name");
  });

  it("does not duplicate 'name' when the config already includes it", () => {
    const path = buildFrappeListRequestPath(config({ fields: ["name", "customer_name"] }));
    const query = new URLSearchParams(path.split("?")[1]);
    const fields = JSON.parse(query.get("fields") ?? "[]");
    expect(fields.filter((f: string) => f === "name")).toHaveLength(1);
  });

  it("omits filters/order_by when not configured", () => {
    const path = buildFrappeListRequestPath(config());
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.has("filters")).toBe(false);
    expect(query.has("order_by")).toBe(false);
  });

  it("serializes filters as [field, operator, value] triples", () => {
    const path = buildFrappeListRequestPath(config({ filters: [{ field: "disabled", operator: "=", value: 0 }] }));
    const query = new URLSearchParams(path.split("?")[1]);
    expect(JSON.parse(query.get("filters") ?? "[]")).toEqual([["disabled", "=", 0]]);
  });

  it("passes orderBy through as order_by", () => {
    const path = buildFrappeListRequestPath(config({ orderBy: "modified desc" }));
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("order_by")).toBe("modified desc");
  });

  it("computes limit_start from a 1-indexed page", () => {
    const path = buildFrappeListRequestPath(config({ pagination: { pageSize: 10, page: 3 } }));
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("limit_start")).toBe("20");
  });

  it("defaults page to 1 when omitted", () => {
    const path = buildFrappeListRequestPath(config({ pagination: { pageSize: 10 } }));
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("limit_start")).toBe("0");
  });

  it("requests one extra row beyond pageSize", () => {
    const path = buildFrappeListRequestPath(config({ pagination: { pageSize: 10 } }));
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("limit_page_length")).toBe("11");
  });

  it("omits or_filters when not given", () => {
    const path = buildFrappeListRequestPath(config());
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.has("or_filters")).toBe(false);
  });

  it("serializes a given orFilters as [field, operator, value] triples, alongside filters", () => {
    const path = buildFrappeListRequestPath(config({ filters: [{ field: "disabled", operator: "=", value: 0 }] }), [
      { field: "customer_name", operator: "like", value: "%acme%" },
      { field: "name", operator: "like", value: "%acme%" },
    ]);
    const query = new URLSearchParams(path.split("?")[1]);
    expect(JSON.parse(query.get("filters") ?? "[]")).toEqual([["disabled", "=", 0]]);
    expect(JSON.parse(query.get("or_filters") ?? "[]")).toEqual([
      ["customer_name", "like", "%acme%"],
      ["name", "like", "%acme%"],
    ]);
  });
});

describe("createFrappeListSource", () => {
  beforeEach(() => {
    frappeFetch.mockReset();
  });

  it("throws on an invalid config", () => {
    expect(() => createFrappeListSource(config({ doctype: "" }))).toThrow(/Invalid frappe-list source config/);
  });

  it("derives a title-cased label and string type for every field", () => {
    const source = createFrappeListSource(config({ fields: ["customer_name"] }));
    expect(source.fields).toEqual(
      expect.arrayContaining([{ name: "customer_name", label: "Customer Name", type: "string" }]),
    );
  });

  it("declares fixed list/filter/sort/pagination capabilities, no search", () => {
    const source = createFrappeListSource(config());
    expect(source.capabilities).toEqual({ list: true, filter: true, sort: true, pagination: true });
  });

  it("maps a Frappe {data:[...]} response and reports hasMore:false at exactly pageSize rows", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [{ name: "CUST-1" }, { name: "CUST-2" }] }));
    const source = createFrappeListSource(config({ pagination: { pageSize: 2 } }));

    const result = await source.resolve({ searchParams: {} });
    expect(result).toEqual({
      data: [{ name: "CUST-1" }, { name: "CUST-2" }],
      pagination: { page: 1, pageSize: 2, hasMore: false },
    });
  });

  it("trims the over-fetched row and reports hasMore:true at pageSize+1 rows", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [{ name: "CUST-1" }, { name: "CUST-2" }, { name: "CUST-3" }] }));
    const source = createFrappeListSource(config({ pagination: { pageSize: 2 } }));

    const result = await source.resolve({ searchParams: {} });
    expect(result.data).toEqual([{ name: "CUST-1" }, { name: "CUST-2" }]);
    expect(result.pagination.hasMore).toBe(true);
  });

  it("handles an empty result", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    const source = createFrappeListSource(config());

    const result = await source.resolve({ searchParams: {} });
    expect(result).toEqual({ data: [], pagination: { page: 1, pageSize: 2, hasMore: false } });
  });

  it("ignores searchParams.page entirely - only the config's own pagination.page is ever used", async () => {
    // Regression: an earlier version of this resolver read a flat, unnamespaced
    // `?page=` here directly - the exact bug that made two frappe-list bindings
    // on one page collide. Request-driven paging now lives one layer up
    // (runtime/data/resolver.ts, which knows a source's name), so this file
    // must never look at searchParams at all.
    frappeFetch.mockResolvedValue(jsonResponse({ data: [{ name: "CUST-1" }] }));
    const source = createFrappeListSource(config({ pagination: { pageSize: 2, page: 1 } }));

    const result = await source.resolve({ searchParams: { page: "99" } });
    expect(result.pagination.page).toBe(1);
    expect(String(frappeFetch.mock.calls[0][0])).toContain("limit_start=0");
  });

  it("handles a non-ok Frappe response without throwing", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({}, false));
    const source = createFrappeListSource(config());

    const result = await source.resolve({ searchParams: {} });
    expect(result).toEqual({ data: [], pagination: { page: 1, pageSize: 2, hasMore: false } });
  });

  it("echoes the config's orderBy back on the result, in both the success and not-ok fallback branches", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [{ name: "CUST-1" }] }));
    const ok = await createFrappeListSource(config({ orderBy: "modified desc" })).resolve({ searchParams: {} });
    expect(ok.orderBy).toBe("modified desc");

    frappeFetch.mockResolvedValue(jsonResponse({}, false));
    const fallback = await createFrappeListSource(config({ orderBy: "modified desc" })).resolve({ searchParams: {} });
    expect(fallback.orderBy).toBe("modified desc");
  });

  it("passes options.orFilters through to the request as or_filters", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    const source = createFrappeListSource(config(), {
      orFilters: [{ field: "customer_name", operator: "like", value: "%acme%" }],
    });

    await source.resolve({ searchParams: {} });
    expect(String(frappeFetch.mock.calls[0][0])).toContain("or_filters");
  });

  it("registers through the existing Data Source Registry and resolves by id", () => {
    const source = createFrappeListSource(config({ id: "test.frappe-list-registration" }));
    registerDataSource(source);

    expect(getDataSource("test.frappe-list-registration")).toBeDefined();
    expect(listDataSources().map((s) => s.id)).toContain("test.frappe-list-registration");
  });
});

describe("existing sources remain unaffected", () => {
  // Longer timeout: this dynamically imports the real dashboard.ts/customers.ts
  // (and their transitive src/lib/frappe/*.server.ts chain), which is slower
  // than the mocked-fetch tests above, especially under a loaded test run.
  it("dashboard and customers still resolve after frappe-list-resolver is imported", async () => {
    await import("@/runtime/data/sources");
    expect(getDataSource("dashboard.overview")).toBeDefined();
    expect(getDataSource("customers")).toBeDefined();
  }, 15000);
});
