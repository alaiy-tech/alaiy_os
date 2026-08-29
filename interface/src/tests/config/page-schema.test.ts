import { describe, expect, it } from "vitest";

import { DATA_SOURCE_REF_SCHEMA, PAGE_CONFIG_FILE_SCHEMA } from "@/config/page-schema";

describe("DATA_SOURCE_REF_SCHEMA", () => {
  it("accepts a plain string source (named registry id) - regression", () => {
    expect(DATA_SOURCE_REF_SCHEMA.safeParse({ source: "customers" }).success).toBe(true);
  });

  it("accepts a string source with a path", () => {
    expect(DATA_SOURCE_REF_SCHEMA.safeParse({ source: "dashboard.salesTrend", path: "points" }).success).toBe(true);
  });

  it("rejects an empty string source", () => {
    expect(DATA_SOURCE_REF_SCHEMA.safeParse({ source: "" }).success).toBe(false);
  });

  it("rejects a source that is neither a string nor an object", () => {
    expect(DATA_SOURCE_REF_SCHEMA.safeParse({ source: 42 }).success).toBe(false);
  });

  it("rejects an inline object source - every generic data need is a named page.data entry now", () => {
    expect(
      DATA_SOURCE_REF_SCHEMA.safeParse({ source: { type: "frappe", operation: "count", doctype: "Customer" } }).success,
    ).toBe(false);
  });

  it("accepts a { ref } binding referencing a page-level data entry", () => {
    expect(DATA_SOURCE_REF_SCHEMA.safeParse({ ref: "customers" }).success).toBe(true);
    expect(DATA_SOURCE_REF_SCHEMA.safeParse({ ref: "customers", path: "rows" }).success).toBe(true);
  });

  it("rejects an empty ref", () => {
    expect(DATA_SOURCE_REF_SCHEMA.safeParse({ ref: "" }).success).toBe(false);
  });

  it("rejects a binding with neither source nor ref", () => {
    expect(DATA_SOURCE_REF_SCHEMA.safeParse({ path: "data" }).success).toBe(false);
  });
});

describe("PAGE_CONFIG_FILE_SCHEMA - definition.data", () => {
  function pageJson(data: unknown) {
    return {
      id: "test-page",
      route: "/os/test-page",
      definition: {
        id: "test-def",
        kind: "page",
        data,
        children: [{ id: "header", kind: "component", type: "os-page-header", props: { title: "Test" } }],
      },
    };
  }

  it("round-trips definition.data through parsing rather than silently stripping it", () => {
    // Regression: PAGE_DEFINITION_SCHEMA is not .strict() - zod's default
    // behavior for an undeclared key is to silently drop it, not error, so
    // this has to assert the *shape survives*, not just that parsing succeeds.
    const result = PAGE_CONFIG_FILE_SCHEMA.safeParse(
      pageJson({
        customers: {
          request: {
            type: "frappe",
            operation: "list",
            doctype: "Customer",
            params: { fields: ["name"], pageSize: 10 },
          },
        },
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.definition.data).toEqual({
        customers: {
          request: {
            type: "frappe",
            operation: "list",
            doctype: "Customer",
            params: { fields: ["name"], pageSize: 10 },
          },
        },
      });
    }
  });

  it("accepts a page with no definition.data at all (regression)", () => {
    expect(PAGE_CONFIG_FILE_SCHEMA.safeParse(pageJson(undefined)).success).toBe(true);
  });

  it("rejects a malformed definition.data entry", () => {
    const result = PAGE_CONFIG_FILE_SCHEMA.safeParse(
      pageJson({ customers: { request: { type: "frappe", operation: "list", doctype: "Customer" } } }),
    );
    expect(result.success).toBe(false);
  });
});
