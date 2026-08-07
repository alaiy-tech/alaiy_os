import { describe, expect, it } from "vitest";

import { resolveDataSource, sourceKey } from "@/runtime/data/resolve-data-source";

describe("sourceKey", () => {
  it("returns a string source as-is", () => {
    expect(sourceKey("customers")).toBe("customers");
  });

  it("is stable for the same inline object read twice", () => {
    const source = {
      type: "frappe-list" as const,
      doctype: "Customer",
      fields: ["name"],
      pagination: { pageSize: 20 },
    };
    expect(sourceKey(source)).toBe(sourceKey(source));
  });

  it("derives the same key for two differently-key-ordered but equal inline configs", () => {
    const a = { type: "frappe-list" as const, doctype: "Customer", fields: ["name"], pagination: { pageSize: 20 } };
    const b = { pagination: { pageSize: 20 }, fields: ["name"], type: "frappe-list" as const, doctype: "Customer" };
    expect(sourceKey(a)).toBe(sourceKey(b));
  });

  it("does not sort array element order (fields order is meaningful)", () => {
    const a = {
      type: "frappe-count" as const,
      doctype: "Customer",
      filters: [
        { field: "a", operator: "=" as const, value: 1 },
        { field: "b", operator: "=" as const, value: 2 },
      ],
    };
    const b = {
      type: "frappe-count" as const,
      doctype: "Customer",
      filters: [
        { field: "b", operator: "=" as const, value: 2 },
        { field: "a", operator: "=" as const, value: 1 },
      ],
    };
    expect(sourceKey(a)).not.toBe(sourceKey(b));
  });

  it("derives different keys for structurally different inline configs", () => {
    const a = { type: "frappe-count" as const, doctype: "Customer" };
    const b = { type: "frappe-count" as const, doctype: "Item" };
    expect(sourceKey(a)).not.toBe(sourceKey(b));
  });
});

describe("resolveDataSource", () => {
  it("looks up a string source directly by key", () => {
    const data = { customers: [{ id: 1 }] };
    expect(resolveDataSource(data, { source: "customers" })).toEqual([{ id: 1 }]);
  });

  it("looks up an inline object source via its derived sourceKey", () => {
    const source = {
      type: "frappe-list" as const,
      doctype: "Customer",
      fields: ["name"],
      pagination: { pageSize: 20 },
    };
    const data = {
      [sourceKey(source)]: { data: [{ name: "CUST-1" }], pagination: { page: 1, pageSize: 20, hasMore: false } },
    };
    expect(resolveDataSource(data, { source })).toEqual({
      data: [{ name: "CUST-1" }],
      pagination: { page: 1, pageSize: 20, hasMore: false },
    });
  });

  it("applies path against an inline source's resolved value", () => {
    const source = {
      type: "frappe-list" as const,
      doctype: "Customer",
      fields: ["name"],
      pagination: { pageSize: 20 },
    };
    const data = {
      [sourceKey(source)]: { data: [{ name: "CUST-1" }], pagination: { page: 1, pageSize: 20, hasMore: false } },
    };
    expect(resolveDataSource(data, { source, path: "data" })).toEqual([{ name: "CUST-1" }]);
  });

  it("a missing key resolves to undefined rather than throwing", () => {
    expect(() => resolveDataSource({}, { source: "does-not-exist" })).not.toThrow();
    expect(resolveDataSource({}, { source: "does-not-exist" })).toBeUndefined();
  });

  it("a { ref } binding reads the page-data-prefixed key, and applies path on top", () => {
    const data = {
      "page-data:customers": { data: [{ name: "CUST-1" }], pagination: { page: 1, pageSize: 10, hasMore: false } },
    };
    expect(resolveDataSource(data, { ref: "customers" })).toEqual(data["page-data:customers"]);
    expect(resolveDataSource(data, { ref: "customers", path: "data" })).toEqual([{ name: "CUST-1" }]);
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
