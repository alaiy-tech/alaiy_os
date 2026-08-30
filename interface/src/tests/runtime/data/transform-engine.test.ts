import { describe, expect, it } from "vitest";

import { applyTransforms, toResolvedValue } from "@/runtime/data/transform-engine";

describe("applyTransforms - the AOV shape (sum + count + formula)", () => {
  it("computes revenue, orders, and aov from the same row set without consuming rows", () => {
    const context = { rows: [{ grand_total: 100 }, { grand_total: 300 }], computed: {} };
    const result = applyTransforms(context, [
      { type: "sum", field: "grand_total", as: "revenue" },
      { type: "count", as: "orders" },
      { type: "formula", expression: "revenue / orders", as: "aov" },
    ]);

    expect(result.computed).toEqual({ revenue: 400, orders: 2, aov: 200 });
    expect(result.rows).toHaveLength(2);
  });

  it("sum/avg/min/max ignore non-numeric field values", () => {
    const context = { rows: [{ v: 10 }, { v: "not a number" }, { v: 20 }], computed: {} };
    const result = applyTransforms(context, [{ type: "sum", field: "v", as: "total" }]);
    expect(result.computed.total).toBe(30);
  });
});

describe("applyTransforms - the sales-by-month shape (group + sort + limit)", () => {
  it("groups by month, sums per group, sorts ascending, and limits", () => {
    const context = {
      rows: [
        { transaction_date: "2026-01-15", grand_total: 100 },
        { transaction_date: "2026-01-20", grand_total: 50 },
        { transaction_date: "2026-02-01", grand_total: 200 },
      ],
      computed: {},
    };
    const result = applyTransforms(context, [
      {
        type: "group",
        by: "transaction_date",
        granularity: "month",
        aggregate: { type: "sum", field: "grand_total", as: "revenue" },
      },
      { type: "sort", field: "key", direction: "asc" },
      { type: "limit", count: 12 },
    ]);

    expect(result.rows).toEqual([
      { key: "2026-01", revenue: 150 },
      { key: "2026-02", revenue: 200 },
    ]);
  });

  it("limit truncates to the requested count", () => {
    const context = { rows: [{ v: 1 }, { v: 2 }, { v: 3 }], computed: {} };
    const result = applyTransforms(context, [{ type: "limit", count: 2 }]);
    expect(result.rows).toHaveLength(2);
  });
});

describe("applyTransforms - select/filter/sort", () => {
  it("select projects only the requested fields", () => {
    const context = { rows: [{ a: 1, b: 2, c: 3 }], computed: {} };
    const result = applyTransforms(context, [{ type: "select", fields: ["a", "c"] }]);
    expect(result.rows).toEqual([{ a: 1, c: 3 }]);
  });

  it("filter keeps only matching rows", () => {
    const context = { rows: [{ status: "Open" }, { status: "Closed" }], computed: {} };
    const result = applyTransforms(context, [{ type: "filter", field: "status", operator: "=", value: "Open" }]);
    expect(result.rows).toEqual([{ status: "Open" }]);
  });

  it("sort orders rows by field, ascending or descending", () => {
    const context = { rows: [{ v: 3 }, { v: 1 }, { v: 2 }], computed: {} };
    const asc = applyTransforms(context, [{ type: "sort", field: "v", direction: "asc" }]);
    expect(asc.rows?.map((r) => r.v)).toEqual([1, 2, 3]);
    const desc = applyTransforms(context, [{ type: "sort", field: "v", direction: "desc" }]);
    expect(desc.rows?.map((r) => r.v)).toEqual([3, 2, 1]);
  });
});

describe("applyTransforms - lookup (static value->value mapping)", () => {
  it("maps a matching computed value through cases", () => {
    const context = { computed: { period: "1D" } };
    const result = applyTransforms(context, [
      {
        type: "lookup",
        field: "period",
        cases: { "1D": "since last day", "1M": "since last month" },
        as: "periodLabel",
      },
    ]);
    expect(result.computed.periodLabel).toBe("since last day");
  });

  it("falls back to `default` when the value matches no case", () => {
    const context = { computed: { period: "1Q" } };
    const result = applyTransforms(context, [
      {
        type: "lookup",
        field: "period",
        cases: { "1D": "since last day" },
        default: "last period",
        as: "periodLabel",
      },
    ]);
    expect(result.computed.periodLabel).toBe("last period");
  });

  it("is undefined (not thrown) when there's no default and no match", () => {
    const context = { computed: { period: "1Q" } };
    const result = applyTransforms(context, [
      { type: "lookup", field: "period", cases: { "1D": "since last day" }, as: "periodLabel" },
    ]);
    expect(result.computed.periodLabel).toBeUndefined();
  });
});

describe("applyTransforms - an empty/absent pipeline is a no-op", () => {
  it("returns the context unchanged", () => {
    const context = { rows: [{ a: 1 }], computed: { existing: true } };
    expect(applyTransforms(context, undefined)).toEqual(context);
    expect(applyTransforms(context, [])).toEqual(context);
  });
});

describe("toResolvedValue", () => {
  it("folds rows in alongside computed keys", () => {
    expect(toResolvedValue({ rows: [{ a: 1 }], computed: { count: 1 } })).toEqual({ count: 1, rows: [{ a: 1 }] });
  });

  it("omits rows entirely when there are none (a count/method result)", () => {
    expect(toResolvedValue({ computed: { count: 7 } })).toEqual({ count: 7 });
  });
});
