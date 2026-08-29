import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerDataSource } from "@/runtime/registry/data-source-registry";
import type { UIPageDefinition } from "@/types/runtime/page";

const { frappeFetch } = vi.hoisted(() => ({ frappeFetch: vi.fn() }));
vi.mock("@/lib/frappe/server", () => ({ frappeFetch }));

const { resolvePageData } = await import("@/runtime/data/resolver");

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function pageWithData(data: UIPageDefinition["data"], children: UIPageDefinition["children"] = []): UIPageDefinition {
  return { id: "test-page", kind: "page", data, children };
}

function queryOf(path: string): URLSearchParams {
  return new URLSearchParams(path.split("?")[1]);
}

describe("resolvePageData - registered string sources", () => {
  beforeEach(() => {
    frappeFetch.mockReset();
  });

  it("resolves a { source: string } binding through the Data Source Registry", async () => {
    registerDataSource({
      id: "test.named",
      description: "A named source",
      capabilities: {},
      fields: [],
      async resolve() {
        return { count: 42 };
      },
    });

    const definition = pageWithData(undefined, [
      { id: "kpi", kind: "component", type: "os-kpi", data: { value: { source: "test.named", path: "count" } } },
    ]);

    const data = await resolvePageData(definition, { searchParams: {} });
    expect(data["test.named"]).toEqual({ count: 42 });
  });

  it("resolves each distinct registered id exactly once, even with two bindings", async () => {
    let calls = 0;
    registerDataSource({
      id: "test.shared",
      description: "Shared source",
      capabilities: {},
      fields: [],
      async resolve() {
        calls++;
        return { value: 1 };
      },
    });

    const definition = pageWithData(undefined, [
      { id: "a", kind: "component", type: "os-kpi", data: { value: { source: "test.shared" } } },
      { id: "b", kind: "component", type: "os-kpi", data: { value: { source: "test.shared" } } },
    ]);

    await resolvePageData(definition, { searchParams: {} });
    expect(calls).toBe(1);
  });

  it("an unregistered string source resolves to undefined rather than throwing", async () => {
    const definition = pageWithData(undefined, [
      { id: "kpi", kind: "component", type: "os-kpi", data: { value: { source: "does-not-exist" } } },
    ]);
    const data = await resolvePageData(definition, { searchParams: {} });
    expect(data["does-not-exist"]).toBeUndefined();
  });
});

describe("resolvePageData - named data definitions (list/count/method)", () => {
  beforeEach(() => {
    frappeFetch.mockReset();
  });

  it("resolves a list operation and exposes rows + pagination from one Frappe call", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [{ name: "CUST-1" }] }));

    const definition = pageWithData(
      {
        customers: {
          request: {
            type: "frappe",
            operation: "list",
            doctype: "Customer",
            params: { fields: ["name"], pageSize: 10 },
          },
          query: { pagination: { pageSize: 10 } },
        },
      },
      [
        { id: "table", kind: "component", type: "os-data-table", data: { rows: { ref: "customers", path: "rows" } } },
        { id: "footer", kind: "component", type: "os-kpi", data: { value: { ref: "customers", path: "pagination" } } },
      ],
    );

    const data = await resolvePageData(definition, { searchParams: {} });
    expect(frappeFetch).toHaveBeenCalledTimes(1);
    expect(data["page-data:customers"]).toEqual({
      rows: [{ name: "CUST-1" }],
      pagination: { page: 1, pageSize: 10, hasMore: false },
    });
  });

  it("a list request with no query.pagination fetches a plain cap, no over-fetch/hasMore trick", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [{ name: "CUST-1" }] }));
    const definition = pageWithData({
      customers: {
        request: {
          type: "frappe",
          operation: "list",
          doctype: "Customer",
          params: { fields: ["name"], pageSize: 1000 },
        },
      },
    });

    await resolvePageData(definition, { searchParams: {} });
    expect(queryOf(String(frappeFetch.mock.calls[0][0])).get("limit_page_length")).toBe("1000");
  });

  it("resolves a count operation to a plain number under computed.count", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: 7 }));
    const definition = pageWithData({
      activeCustomers: { request: { type: "frappe", operation: "count", doctype: "Customer" } },
    });

    const data = await resolvePageData(definition, { searchParams: {} });
    expect(data["page-data:activeCustomers"]).toEqual({ count: 7 });
    expect(String(frappeFetch.mock.calls[0][0])).toContain("frappe.client.get_count");
  });

  it("resolves a method operation, spreading its message object as the result", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: { total_sales: { current: 100, previous: 80 } } }));
    const definition = pageWithData({
      overview: {
        request: { type: "frappe", operation: "method", method: "alaiy_os.api.dashboard_stats.get_dashboard_overview" },
      },
    });

    const data = await resolvePageData(definition, { searchParams: {} });
    expect(data["page-data:overview"]).toEqual({ total_sales: { current: 100, previous: 80 } });
    expect(String(frappeFetch.mock.calls[0][0])).toContain("alaiy_os.api.dashboard_stats.get_dashboard_overview");
  });

  it("applies a transform pipeline (sum + count + formula) over a list result", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [{ grand_total: 100 }, { grand_total: 300 }] }));
    const definition = pageWithData({
      aov: {
        request: {
          type: "frappe",
          operation: "list",
          doctype: "Sales Order",
          params: { fields: ["grand_total"], pageSize: 1000 },
        },
        transform: [
          { type: "sum", field: "grand_total", as: "revenue" },
          { type: "count", as: "orders" },
          { type: "formula", expression: "revenue / orders", as: "aov" },
        ],
      },
    });

    const data = await resolvePageData(definition, { searchParams: {} });
    expect(data["page-data:aov"]).toMatchObject({ revenue: 400, orders: 2, aov: 200 });
  });
});

describe("resolvePageData - query state (page/sort/search/filter)", () => {
  beforeEach(() => {
    frappeFetch.mockReset();
  });

  function suppliersPage(searchParams: Record<string, string | string[] | undefined>) {
    const definition = pageWithData({
      suppliers: {
        request: {
          type: "frappe",
          operation: "list",
          doctype: "Supplier",
          params: { fields: ["name", "supplier_name", "country"], orderBy: "modified desc", pageSize: 10 },
        },
        query: {
          pagination: { pageSize: 10 },
          sort: { allowedFields: ["supplier_name", "name"] },
          search: { fields: ["supplier_name", "name"] },
          filters: [{ field: "country", operator: "like" }],
        },
      },
    });
    return resolvePageData(definition, { searchParams });
  }

  it("reads name_page and computes the correct limit_start", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({ suppliers_page: "3" });
    expect(queryOf(String(frappeFetch.mock.calls[0][0])).get("limit_start")).toBe("20");
  });

  it("a valid name_sort overrides the static orderBy; an invalid one falls back", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({ suppliers_sort: "supplier_name asc" });
    expect(queryOf(String(frappeFetch.mock.calls[0][0])).get("order_by")).toBe("supplier_name asc");

    frappeFetch.mockClear();
    await suppliersPage({ suppliers_sort: "secret_field asc" });
    expect(queryOf(String(frappeFetch.mock.calls[0][0])).get("order_by")).toBe("modified desc");
  });

  it("a name_search term builds or_filters from the declared search fields, wildcarded", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({ suppliers_search: "acme" });
    const orFilters = JSON.parse(queryOf(String(frappeFetch.mock.calls[0][0])).get("or_filters") ?? "[]");
    expect(orFilters).toEqual([
      ["supplier_name", "like", "%acme%"],
      ["name", "like", "%acme%"],
    ]);
  });

  it("a name_filter_<field> value merges into filters, wildcarded for a like operator", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({ suppliers_filter_country: "india" });
    const filters = JSON.parse(queryOf(String(frappeFetch.mock.calls[0][0])).get("filters") ?? "[]");
    expect(filters).toEqual([["country", "like", "%india%"]]);
  });

  it("two independent named entries keep independent page/sort/search state", async () => {
    frappeFetch.mockImplementation(async (path: string) => {
      const isOrders = path.includes("Sales%20Order");
      return jsonResponse({ data: [{ name: isOrders ? "SO-1" : "SUP-1" }] });
    });

    const definition = pageWithData({
      suppliers: {
        request: { type: "frappe", operation: "list", doctype: "Supplier", params: { fields: ["name"], pageSize: 10 } },
        query: { pagination: { pageSize: 10 } },
      },
      orders: {
        request: {
          type: "frappe",
          operation: "list",
          doctype: "Sales Order",
          params: { fields: ["name"], pageSize: 10 },
        },
        query: { pagination: { pageSize: 10 } },
      },
    });

    await resolvePageData(definition, { searchParams: { suppliers_page: "2", orders_page: "5" } });
    const suppliersCall = frappeFetch.mock.calls.find((c) => String(c[0]).includes("Supplier"));
    const ordersCall = frappeFetch.mock.calls.find((c) => String(c[0]).includes("Sales"));
    expect(queryOf(String(suppliersCall?.[0])).get("limit_start")).toBe("10");
    expect(queryOf(String(ordersCall?.[0])).get("limit_start")).toBe("40");
  });

  it("a count/method operation ignores query state entirely - it has none to read", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: 5 }));
    const definition = pageWithData({
      suppliers: { request: { type: "frappe", operation: "count", doctype: "Supplier" } },
    });

    const data = await resolvePageData(definition, {
      searchParams: { suppliers_page: "9", suppliers_sort: "x", suppliers_search: "x" },
    });
    expect(data["page-data:suppliers"]).toEqual({ count: 5 });
    expect(String(frappeFetch.mock.calls[0][0])).not.toContain("filters");
  });
});

describe("resolvePageData - period sentinel substitution", () => {
  beforeEach(() => {
    frappeFetch.mockReset();
  });

  it("substitutes $period in a method request's args from the global ?period=", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: {} }));
    const definition = pageWithData({
      overview: {
        request: {
          type: "frappe",
          operation: "method",
          method: "alaiy_os.api.dashboard_stats.get_dashboard_overview",
          args: { period: "$period" },
        },
      },
    });

    await resolvePageData(definition, { searchParams: { period: "1Y" } });
    expect(queryOf(`?${String(frappeFetch.mock.calls[0][0]).split("?")[1]}`).get("period")).toBe("1Y");
  });

  it("substitutes $period_start in a list filter to an ISO date, and defaults to 1M when absent", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    const definition = pageWithData({
      aov: {
        request: {
          type: "frappe",
          operation: "list",
          doctype: "Sales Order",
          params: {
            fields: ["grand_total"],
            filters: [{ field: "transaction_date", operator: ">=", value: "$period_start" }],
            pageSize: 1000,
          },
        },
      },
    });

    await resolvePageData(definition, { searchParams: {} });
    const filters = JSON.parse(queryOf(String(frappeFetch.mock.calls[0][0])).get("filters") ?? "[]");
    expect(filters[0][0]).toBe("transaction_date");
    expect(filters[0][2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
