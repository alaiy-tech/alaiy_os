import { describe, expect, it } from "vitest";

import { DATA_DEFINITION_SCHEMA } from "@/config/data-definition-schema";
import { DATA_REQUEST_SCHEMA } from "@/config/data-request-schema";
import { TRANSFORM_STEP_SCHEMA } from "@/config/data-transform-schema";

describe("DATA_REQUEST_SCHEMA", () => {
  it("accepts a valid list request", () => {
    const result = DATA_REQUEST_SCHEMA.safeParse({
      type: "frappe",
      operation: "list",
      doctype: "Customer",
      params: { fields: ["name"], pageSize: 10 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid count request with no params", () => {
    expect(DATA_REQUEST_SCHEMA.safeParse({ type: "frappe", operation: "count", doctype: "Customer" }).success).toBe(
      true,
    );
  });

  it("accepts a valid method request", () => {
    const result = DATA_REQUEST_SCHEMA.safeParse({
      type: "frappe",
      operation: "method",
      method: "alaiy_os.api.dashboard_stats.get_dashboard_overview",
      args: { period: "1M", channel: null },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unrecognised operation", () => {
    expect(DATA_REQUEST_SCHEMA.safeParse({ type: "frappe", operation: "aggregate", doctype: "Customer" }).success).toBe(
      false,
    );
  });

  it("rejects an unrecognised top-level key (.strict())", () => {
    const result = DATA_REQUEST_SCHEMA.safeParse({
      type: "frappe",
      operation: "list",
      doctype: "Customer",
      params: { fields: ["name"], pageSize: 10 },
      extra: "nope",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an in/not-in filter operator with a scalar value", () => {
    const result = DATA_REQUEST_SCHEMA.safeParse({
      type: "frappe",
      operation: "list",
      doctype: "Customer",
      params: { fields: ["name"], pageSize: 10, filters: [{ field: "status", operator: "in", value: "Active" }] },
    });
    expect(result.success).toBe(false);
  });
});

describe("TRANSFORM_STEP_SCHEMA", () => {
  it("accepts every step type", () => {
    const steps = [
      { type: "select", fields: ["a"] },
      { type: "filter", field: "a", operator: "=", value: 1 },
      { type: "sort", field: "a", direction: "asc" },
      { type: "limit", count: 5 },
      { type: "count", as: "n" },
      { type: "sum", field: "a", as: "n" },
      { type: "group", by: "a", aggregate: { type: "sum", field: "a", as: "n" } },
      { type: "formula", expression: "n / 2", as: "half" },
    ];
    for (const step of steps) expect(TRANSFORM_STEP_SCHEMA.safeParse(step).success).toBe(true);
  });

  it("rejects a formula longer than the max length", () => {
    const longExpression = `${"1+".repeat(150)}1`;
    expect(TRANSFORM_STEP_SCHEMA.safeParse({ type: "formula", expression: longExpression, as: "x" }).success).toBe(
      false,
    );
  });

  it("rejects a formula with an unsupported character", () => {
    expect(TRANSFORM_STEP_SCHEMA.safeParse({ type: "formula", expression: "a; b", as: "x" }).success).toBe(false);
    expect(TRANSFORM_STEP_SCHEMA.safeParse({ type: "formula", expression: "'quoted'", as: "x" }).success).toBe(false);
  });
});

describe("DATA_DEFINITION_SCHEMA", () => {
  it("accepts a request-only definition (no query, no transform)", () => {
    const result = DATA_DEFINITION_SCHEMA.safeParse({
      request: { type: "frappe", operation: "count", doctype: "Customer" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a query binding on a non-list operation", () => {
    const result = DATA_DEFINITION_SCHEMA.safeParse({
      request: { type: "frappe", operation: "count", doctype: "Customer" },
      query: { pagination: { pageSize: 10 } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a duplicate field across query.filters", () => {
    const result = DATA_DEFINITION_SCHEMA.safeParse({
      request: { type: "frappe", operation: "list", doctype: "Customer", params: { fields: ["name"], pageSize: 10 } },
      query: {
        filters: [
          { field: "status", operator: "=" },
          { field: "status", operator: "like" },
        ],
      },
    });
    expect(result.success).toBe(false);
  });
});
