import { describe, expect, it } from "vitest";

import { getPath, resolveDataSource } from "@/runtime/data/resolve-data-source";

describe("resolveDataSource", () => {
  it("looks up a registered string source directly by its bare id", () => {
    const data = { customers: [{ id: 1 }] };
    expect(resolveDataSource(data, { source: "customers" })).toEqual([{ id: 1 }]);
  });

  it("applies path against a string source's resolved value", () => {
    const data = { customers: { data: [{ name: "CUST-1" }], pagination: { page: 1, pageSize: 20, hasMore: false } } };
    expect(resolveDataSource(data, { source: "customers", path: "data" })).toEqual([{ name: "CUST-1" }]);
  });

  it("a missing key resolves to undefined rather than throwing", () => {
    expect(() => resolveDataSource({}, { source: "does-not-exist" })).not.toThrow();
    expect(resolveDataSource({}, { source: "does-not-exist" })).toBeUndefined();
  });

  it("a { ref } binding reads the page-data-prefixed key, and applies path on top", () => {
    const data = {
      "page-data:customers": { rows: [{ name: "CUST-1" }], pagination: { page: 1, pageSize: 10, hasMore: false } },
    };
    expect(resolveDataSource(data, { ref: "customers" })).toEqual(data["page-data:customers"]);
    expect(resolveDataSource(data, { ref: "customers", path: "rows" })).toEqual([{ name: "CUST-1" }]);
    expect(resolveDataSource(data, { ref: "customers", path: "pagination" })).toEqual({
      page: 1,
      pageSize: 10,
      hasMore: false,
    });
  });

  it("an unknown ref name resolves to undefined rather than throwing", () => {
    expect(() => resolveDataSource({}, { ref: "does-not-exist" })).not.toThrow();
    expect(resolveDataSource({}, { ref: "does-not-exist" })).toBeUndefined();
  });

  it("a page-data entry and a registered string source with the same bare name never collide", () => {
    const data = {
      customers: "the registry-resolved value",
      "page-data:customers": "the page-level named entry's value",
    };
    expect(resolveDataSource(data, { source: "customers" })).toBe("the registry-resolved value");
    expect(resolveDataSource(data, { ref: "customers" })).toBe("the page-level named entry's value");
  });
});

describe("getPath", () => {
  it("reaches a nested value", () => {
    expect(getPath({ total_sales: { current: 100 } }, "total_sales.current")).toBe(100);
  });

  it("a missing segment resolves to undefined rather than throwing", () => {
    expect(getPath({ a: 1 }, "b.c")).toBeUndefined();
    expect(getPath(null, "a")).toBeUndefined();
    expect(getPath(undefined, "a")).toBeUndefined();
  });

  it("rejects __proto__/constructor/prototype path segments outright", () => {
    expect(getPath({}, "__proto__.polluted")).toBeUndefined();
    expect(getPath({}, "constructor.prototype")).toBeUndefined();
    expect(getPath({ a: { constructor: { name: "trap" } } }, "a.constructor.name")).toBeUndefined();
  });
});
