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

  it("accepts an inline frappe-list source", () => {
    const result = DATA_SOURCE_REF_SCHEMA.safeParse({
      source: {
        type: "frappe-list",
        doctype: "Customer",
        fields: ["name", "customer_name"],
        pagination: { pageSize: 20 },
      },
      path: "data",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an inline frappe-count source", () => {
    const result = DATA_SOURCE_REF_SCHEMA.safeParse({
      source: { type: "frappe-count", doctype: "Customer", filters: [{ field: "disabled", operator: "=", value: 0 }] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an inline frappe-list source missing doctype", () => {
    const result = DATA_SOURCE_REF_SCHEMA.safeParse({
      source: { type: "frappe-list", fields: ["name"], pagination: { pageSize: 20 } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an inline source with a bad filter operator", () => {
    const result = DATA_SOURCE_REF_SCHEMA.safeParse({
      source: {
        type: "frappe-count",
        doctype: "Customer",
        filters: [{ field: "status", operator: "between", value: ["a", "b"] }],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an inline source with an unrecognised type", () => {
    const result = DATA_SOURCE_REF_SCHEMA.safeParse({ source: { type: "frappe-bogus", doctype: "Customer" } });
    expect(result.success).toBe(false);
  });

  it("rejects a source that is neither a string nor an object", () => {
    expect(DATA_SOURCE_REF_SCHEMA.safeParse({ source: 42 }).success).toBe(false);
  });

  it("accepts a { ref } binding referencing a page-level data entry", () => {
    expect(DATA_SOURCE_REF_SCHEMA.safeParse({ ref: "customers" }).success).toBe(true);
    expect(DATA_SOURCE_REF_SCHEMA.safeParse({ ref: "customers", path: "data" }).success).toBe(true);
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
        customers: { type: "frappe-list", doctype: "Customer", fields: ["name"], pagination: { pageSize: 10 } },
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.definition.data).toEqual({
        customers: { type: "frappe-list", doctype: "Customer", fields: ["name"], pagination: { pageSize: 10 } },
      });
    }
  });

  it("accepts a page with no definition.data at all (regression)", () => {
    expect(PAGE_CONFIG_FILE_SCHEMA.safeParse(pageJson(undefined)).success).toBe(true);
  });

  it("rejects a malformed definition.data entry", () => {
    const result = PAGE_CONFIG_FILE_SCHEMA.safeParse(
      pageJson({ customers: { type: "frappe-list", fields: ["name"] } }),
    );
    expect(result.success).toBe(false);
  });
});
