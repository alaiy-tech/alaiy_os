import { describe, expect, it } from "vitest";

import { FRAPPE_LIST_SOURCE_CONFIG_SCHEMA } from "@/config/frappe-list-schema";

function validConfig(overrides: Record<string, unknown> = {}) {
  return {
    type: "frappe-list",
    id: "customers.list",
    description: "Customer roster",
    doctype: "Customer",
    fields: ["customer_name", "customer_group", "territory"],
    filters: [{ field: "disabled", operator: "=", value: 0 }],
    orderBy: "modified desc",
    pagination: { pageSize: 20 },
    ...overrides,
  };
}

describe("frappe-list-schema", () => {
  it("accepts a fully valid config", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig());
    expect(result.success).toBe(true);
  });

  it("accepts a minimal config with no filters/orderBy", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ filters: undefined, orderBy: undefined }));
    expect(result.success).toBe(true);
  });

  it("rejects a missing doctype", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ doctype: undefined }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty doctype", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ doctype: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects an empty fields array", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ fields: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects a fields array with a blank entry", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ fields: ["name", ""] }));
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognised filter operator", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(
      validConfig({ filters: [{ field: "status", operator: "between", value: ["a", "b"] }] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an array value on a non in/not-in operator", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(
      validConfig({ filters: [{ field: "status", operator: "=", value: ["Active", "Disabled"] }] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a non-array value on in/not-in", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(
      validConfig({ filters: [{ field: "status", operator: "in", value: "Active" }] }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts an array value on in/not-in", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(
      validConfig({ filters: [{ field: "status", operator: "in", value: ["Active", "Disabled"] }] }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a malformed orderBy", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ orderBy: "modified newest" }));
    expect(result.success).toBe(false);
  });

  it("accepts a multi-field orderBy", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ orderBy: "modified desc, name asc" }));
    expect(result.success).toBe(true);
  });

  it("rejects a zero or negative pageSize", () => {
    expect(FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ pagination: { pageSize: 0 } })).success).toBe(
      false,
    );
    expect(FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ pagination: { pageSize: -5 } })).success).toBe(
      false,
    );
  });

  it("rejects a pageSize over the cap", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ pagination: { pageSize: 500 } }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer page", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ pagination: { pageSize: 20, page: 1.5 } }));
    expect(result.success).toBe(false);
  });

  it("rejects a missing pagination block", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ pagination: undefined }));
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognised top-level key (.strict())", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(validConfig({ extraKey: "nope" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognised key nested inside a filter (.strict())", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(
      validConfig({ filters: [{ field: "status", operator: "=", value: "Active", extra: true }] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognised key nested inside pagination (.strict())", () => {
    const result = FRAPPE_LIST_SOURCE_CONFIG_SCHEMA.safeParse(
      validConfig({ pagination: { pageSize: 20, extra: true } }),
    );
    expect(result.success).toBe(false);
  });
});
