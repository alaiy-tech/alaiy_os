import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerDataSource } from "@/runtime/registry/data-source-registry";
import type { UIPageDefinition } from "@/types/runtime/page";

const { frappeFetch } = vi.hoisted(() => ({ frappeFetch: vi.fn() }));
vi.mock("@/lib/frappe/server", () => ({ frappeFetch }));

const { resolvePageData } = await import("@/runtime/data/resolver");

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function page(children: UIPageDefinition["children"]): UIPageDefinition {
  return { id: "test-page", kind: "page", children };
}

describe("resolvePageData - inline declarative sources", () => {
  beforeEach(() => {
    frappeFetch.mockReset();
  });

  it("resolves an inline frappe-list source with no registerDataSource call", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [{ name: "CUST-1" }] }));

    const source = {
      type: "frappe-list" as const,
      doctype: "Customer",
      fields: ["name"],
      pagination: { pageSize: 20 },
    };
    const definition = page([
      {
        id: "table",
        kind: "component",
        type: "os-data-table",
        data: { rows: { source, path: "data" } },
      },
    ]);

    const data = await resolvePageData(definition, { searchParams: {} });
    const key = Object.keys(data)[0];
    expect(data[key]).toEqual({
      data: [{ name: "CUST-1" }],
      pagination: { page: 1, pageSize: 20, hasMore: false },
    });
    expect(frappeFetch).toHaveBeenCalledTimes(1);
    expect(String(frappeFetch.mock.calls[0][0])).toContain(
      "/api/resource/Customer",
    );
  });

  it("resolves an inline frappe-count source", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: 7 }));

    const source = { type: "frappe-count" as const, doctype: "Customer" };
    const definition = page([
      {
        id: "kpi",
        kind: "component",
        type: "os-kpi",
        data: { value: { source } },
      },
    ]);

    const data = await resolvePageData(definition, { searchParams: {} });
    const key = Object.keys(data)[0];
    expect(data[key]).toBe(7);
    expect(String(frappeFetch.mock.calls[0][0])).toContain(
      "frappe.client.get_count",
    );
  });

  it("dedups two nodes referencing byte-identical inline configs to one Frappe call", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: 3 }));

    const source = { type: "frappe-count" as const, doctype: "Customer" };
    const definition = page([
      {
        id: "kpi-a",
        kind: "component",
        type: "os-kpi",
        data: { value: { source } },
      },
      {
        id: "kpi-b",
        kind: "component",
        type: "os-kpi",
        data: { value: { source: { ...source } } },
      },
    ]);

    await resolvePageData(definition, { searchParams: {} });
    expect(frappeFetch).toHaveBeenCalledTimes(1);
  });

  it("resolves a mix of a registered string source and an inline source on the same page", async () => {
    registerDataSource({
      id: "test.named",
      description: "A named source",
      capabilities: {},
      fields: [],
      async resolve() {
        return { count: 42 };
      },
    });
    frappeFetch.mockResolvedValue(jsonResponse({ message: 5 }));

    const definition = page([
      {
        id: "kpi-named",
        kind: "component",
        type: "os-kpi",
        data: { value: { source: "test.named", path: "count" } },
      },
      {
        id: "kpi-inline",
        kind: "component",
        type: "os-kpi",
        data: {
          value: {
            source: { type: "frappe-count" as const, doctype: "Customer" },
          },
        },
      },
    ]);

    const data = await resolvePageData(definition, { searchParams: {} });
    expect(Object.keys(data)).toHaveLength(2);
    expect(data["test.named"]).toEqual({ count: 42 });
  });

  it("an inline config with an unrecognised type resolves to undefined rather than throwing", async () => {
    const definition = page([
      // biome-ignore lint/suspicious/noExplicitAny: deliberately testing an invalid/unrecognised inline type.
      {
        id: "kpi",
        kind: "component",
        type: "os-kpi",
        data: { value: { source: { type: "frappe-bogus" } as any } },
      },
    ]);

    const data = await resolvePageData(definition, { searchParams: {} });
    const key = Object.keys(data)[0];
    expect(data[key]).toBeUndefined();
  });
});

describe("resolvePageData - named page-data entries", () => {
  beforeEach(() => {
    frappeFetch.mockReset();
  });

  function pageWithData(
    data: UIPageDefinition["data"],
    children: UIPageDefinition["children"],
  ): UIPageDefinition {
    return { id: "test-page", kind: "page", data, children };
  }

  it("a named entry's rows and pagination are both consumable from one resolution (one Frappe call)", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [{ name: "CUST-1" }] }));

    const definition = pageWithData(
      {
        customers: {
          type: "frappe-list",
          doctype: "Customer",
          fields: ["name"],
          pagination: { pageSize: 10 },
        },
      },
      [
        {
          id: "table",
          kind: "component",
          type: "os-data-table",
          data: { rows: { ref: "customers", path: "data" } },
        },
        {
          id: "footer",
          kind: "component",
          type: "os-kpi",
          data: { value: { ref: "customers", path: "pagination" } },
        },
      ],
    );

    const data = await resolvePageData(definition, { searchParams: {} });
    expect(frappeFetch).toHaveBeenCalledTimes(1);
    expect(data["page-data:customers"]).toEqual({
      data: [{ name: "CUST-1" }],
      pagination: { page: 1, pageSize: 10, hasMore: false },
    });
  });

  it("reads a name_page search param for a named frappe-list entry and substitutes it into the effective config", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [{ name: "CUST-1" }] }));

    const definition = pageWithData(
      {
        customers: {
          type: "frappe-list",
          doctype: "Customer",
          fields: ["name"],
          pagination: { pageSize: 10 },
        },
      },
      [
        {
          id: "table",
          kind: "component",
          type: "os-data-table",
          data: { rows: { ref: "customers", path: "data" } },
        },
      ],
    );

    await resolvePageData(definition, {
      searchParams: { customers_page: "3" },
    });
    expect(String(frappeFetch.mock.calls[0][0])).toContain("limit_start=20");
  });

  it("two named frappe-list entries with independent name_page values resolve independently - the collision fix", async () => {
    frappeFetch.mockImplementation(async (path: string) => {
      const isOrders =
        path.includes("Sales%20Order") || path.includes("Sales Order");
      return jsonResponse({ data: [{ name: isOrders ? "SO-1" : "CUST-1" }] });
    });

    const definition = pageWithData(
      {
        customers: {
          type: "frappe-list",
          doctype: "Customer",
          fields: ["name"],
          pagination: { pageSize: 10 },
        },
        orders: {
          type: "frappe-list",
          doctype: "Sales Order",
          fields: ["name"],
          pagination: { pageSize: 10 },
        },
      },
      [
        {
          id: "t1",
          kind: "component",
          type: "os-data-table",
          data: { rows: { ref: "customers", path: "data" } },
        },
        {
          id: "t2",
          kind: "component",
          type: "os-data-table",
          data: { rows: { ref: "orders", path: "data" } },
        },
      ],
    );

    await resolvePageData(definition, {
      searchParams: { customers_page: "2", orders_page: "5" },
    });

    const customersCall = frappeFetch.mock.calls.find((c) =>
      String(c[0]).includes("Customer"),
    );
    const ordersCall = frappeFetch.mock.calls.find((c) =>
      String(c[0]).includes("Sales"),
    );
    expect(String(customersCall?.[0])).toContain("limit_start=10"); // (2-1)*10
    expect(String(ordersCall?.[0])).toContain("limit_start=40"); // (5-1)*10
  });

  it("a named frappe-count entry ignores any name_page param entirely", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: 12 }));

    const definition = pageWithData(
      { customers: { type: "frappe-count", doctype: "Customer" } },
      [
        {
          id: "kpi",
          kind: "component",
          type: "os-kpi",
          data: { value: { ref: "customers" } },
        },
      ],
    );

    await resolvePageData(definition, {
      searchParams: { customers_page: "9" },
    });
    expect(String(frappeFetch.mock.calls[0][0])).not.toContain("page");
  });

  it("an anonymous inline binding does not dedup against a structurally-identical named entry (disclosed non-goal)", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: 1 }));

    const anonymousSource = {
      type: "frappe-count" as const,
      doctype: "Customer",
    };
    const definition = pageWithData(
      { customers: { type: "frappe-count", doctype: "Customer" } },
      [
        {
          id: "kpi-ref",
          kind: "component",
          type: "os-kpi",
          data: { value: { ref: "customers" } },
        },
        {
          id: "kpi-anon",
          kind: "component",
          type: "os-kpi",
          data: { value: { source: anonymousSource } },
        },
      ],
    );

    await resolvePageData(definition, { searchParams: {} });
    expect(frappeFetch).toHaveBeenCalledTimes(2);
  });
});

describe("resolvePageData - generic list query state (sort/search/filters)", () => {
  beforeEach(() => {
    frappeFetch.mockReset();
  });

  function pageWithData(
    data: UIPageDefinition["data"],
    children: UIPageDefinition["children"],
  ): UIPageDefinition {
    return { id: "test-page", kind: "page", data, children };
  }

  function suppliersPage(
    searchParams: Record<string, string | string[] | undefined>,
  ) {
    const definition = pageWithData(
      {
        suppliers: {
          type: "frappe-list",
          doctype: "Supplier",
          fields: ["name", "supplier_name", "country"],
          orderBy: "modified desc",
          search: { fields: ["supplier_name", "name"] },
          queryFilters: [{ field: "country", operator: "like" }],
          pagination: { pageSize: 10 },
        },
      },
      [
        {
          id: "table",
          kind: "component",
          type: "os-data-table",
          data: { rows: { ref: "suppliers", path: "data" } },
        },
      ],
    );
    return resolvePageData(definition, { searchParams });
  }

  function queryOf(path: string): URLSearchParams {
    return new URLSearchParams(path.split("?")[1]);
  }

  it("a valid name_sort override replaces the config's own orderBy", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({ suppliers_sort: "supplier_name asc" });
    expect(queryOf(String(frappeFetch.mock.calls[0][0])).get("order_by")).toBe(
      "supplier_name asc",
    );
  });

  it("a name_sort referencing an undeclared field falls back to the config's own orderBy", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({ suppliers_sort: "secret_field asc" });
    expect(queryOf(String(frappeFetch.mock.calls[0][0])).get("order_by")).toBe(
      "modified desc",
    );
  });

  it("a malformed name_sort value falls back to the config's own orderBy", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({ suppliers_sort: "not-a-real-order-by" });
    expect(queryOf(String(frappeFetch.mock.calls[0][0])).get("order_by")).toBe(
      "modified desc",
    );
  });

  it("an absent name_sort uses the config's own orderBy", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({});
    expect(queryOf(String(frappeFetch.mock.calls[0][0])).get("order_by")).toBe(
      "modified desc",
    );
  });

  it("a name_search term builds or_filters from the config's declared search fields, wildcarded", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({ suppliers_search: "acme" });
    const orFilters = JSON.parse(
      new URLSearchParams(
        String(frappeFetch.mock.calls[0][0]).split("?")[1],
      ).get("or_filters") ?? "[]",
    );
    expect(orFilters).toEqual([
      ["supplier_name", "like", "%acme%"],
      ["name", "like", "%acme%"],
    ]);
  });

  it("an absent name_search produces no or_filters", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({});
    expect(String(frappeFetch.mock.calls[0][0])).not.toContain("or_filters");
  });

  it("a name_filter_<field> value merges into filters, wildcarded for a like operator", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({ suppliers_filter_country: "india" });
    const filters = JSON.parse(
      new URLSearchParams(
        String(frappeFetch.mock.calls[0][0]).split("?")[1],
      ).get("filters") ?? "[]",
    );
    expect(filters).toEqual([["country", "like", "%india%"]]);
  });

  it("an empty name_filter_<field> value is skipped, not sent as an empty-string filter", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    await suppliersPage({ suppliers_filter_country: "" });
    expect(String(frappeFetch.mock.calls[0][0])).not.toContain("filters");
  });

  it("two named frappe-list entries' sort/search/filter state stay independent", async () => {
    frappeFetch.mockImplementation(async (path: string) => {
      const isOrders = path.includes("Sales%20Order");
      return jsonResponse({ data: [{ name: isOrders ? "SO-1" : "SUP-1" }] });
    });

    const definition = pageWithData(
      {
        suppliers: {
          type: "frappe-list",
          doctype: "Supplier",
          fields: ["name", "supplier_name"],
          search: { fields: ["supplier_name"] },
          pagination: { pageSize: 10 },
        },
        orders: {
          type: "frappe-list",
          doctype: "Sales Order",
          fields: ["name", "customer"],
          search: { fields: ["customer"] },
          pagination: { pageSize: 10 },
        },
      },
      [
        {
          id: "t1",
          kind: "component",
          type: "os-data-table",
          data: { rows: { ref: "suppliers", path: "data" } },
        },
        {
          id: "t2",
          kind: "component",
          type: "os-data-table",
          data: { rows: { ref: "orders", path: "data" } },
        },
      ],
    );

    await resolvePageData(definition, {
      searchParams: { suppliers_search: "acme", orders_search: "widget" },
    });

    const suppliersCall = frappeFetch.mock.calls.find((c) =>
      String(c[0]).includes("Supplier"),
    );
    const ordersCall = frappeFetch.mock.calls.find((c) =>
      String(c[0]).includes("Sales"),
    );
    expect(
      JSON.parse(
        new URLSearchParams(String(suppliersCall?.[0]).split("?")[1]).get(
          "or_filters",
        ) ?? "[]",
      ),
    ).toEqual([["supplier_name", "like", "%acme%"]]);
    expect(
      JSON.parse(
        new URLSearchParams(String(ordersCall?.[0]).split("?")[1]).get(
          "or_filters",
        ) ?? "[]",
      ),
    ).toEqual([["customer", "like", "%widget%"]]);
  });

  it("an anonymous inline binding's search/queryFilters have no effect - only a named entry's URL params are read", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ data: [] }));
    const source = {
      type: "frappe-list" as const,
      doctype: "Supplier",
      fields: ["name"],
      search: { fields: ["name"] },
      queryFilters: [{ field: "name", operator: "like" as const }],
      pagination: { pageSize: 10 },
    };
    const definition = pageWithData(undefined, [
      {
        id: "table",
        kind: "component",
        type: "os-data-table",
        data: { rows: { source, path: "data" } },
      },
    ]);

    await resolvePageData(definition, {
      searchParams: { name_search: "acme", name_filter_name: "acme" },
    });
    expect(String(frappeFetch.mock.calls[0][0])).not.toContain("or_filters");
  });

  it("a frappe-count entry ignores name_sort/name_search/name_filter_<field> entirely", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: 5 }));
    const definition = pageWithData(
      { suppliers: { type: "frappe-count", doctype: "Supplier" } },
      [
        {
          id: "kpi",
          kind: "component",
          type: "os-kpi",
          data: { value: { ref: "suppliers" } },
        },
      ],
    );

    const data = await resolvePageData(definition, {
      searchParams: {
        suppliers_sort: "x",
        suppliers_search: "x",
        suppliers_filter_x: "x",
      },
    });
    expect(data["page-data:suppliers"]).toBe(5);
    expect(String(frappeFetch.mock.calls[0][0])).not.toContain("filters");
  });
});
