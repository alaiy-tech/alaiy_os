import { describe, expect, it } from "vitest";

import { COMPONENT_PROPS_SCHEMAS } from "@/config/component-props-schema";

describe("component-props-schema", () => {
  describe("os-card", () => {
    const schema = COMPONENT_PROPS_SCHEMAS["os-card"];

    it("accepts a className override for card styling", () => {
      const result = schema.safeParse({
        title: "Orders",
        className: "h-full bg-muted",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("os-kpi", () => {
    const schema = COMPONENT_PROPS_SCHEMAS["os-kpi"];

    it("accepts a fully valid literal props object", () => {
      const result = schema.safeParse({
        title: "Total Sales",
        icon: "DollarSign",
        format: "currency",
        trendPolarity: "negative",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an icon name outside the curated KPI_ICON_NAMES set", () => {
      const result = schema.safeParse({
        title: "Total Sales",
        icon: "NotARealIcon",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a wrong-typed field (trend as a string, not number|null)", () => {
      const result = schema.safeParse({ title: "Total Sales", trend: "up" });
      expect(result.success).toBe(false);
    });

    it("rejects an unrecognised prop key (.strict())", () => {
      const result = schema.safeParse({
        title: "Total Sales",
        notARealProp: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("os-chart", () => {
    const schema = COMPONENT_PROPS_SCHEMAS["os-chart"];

    it("accepts a valid series array", () => {
      const result = schema.safeParse({
        x: "period",
        series: [
          { field: "revenue", label: "Revenue", type: "area" },
          {
            field: "profit",
            label: "Profit",
            type: "bar",
            color: "var(--chart-2)",
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects a series entry with an unrecognised chart type", () => {
      const result = schema.safeParse({
        x: "period",
        series: [{ field: "revenue", label: "Revenue", type: "pie" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("os-data-table", () => {
    const schema = COMPONENT_PROPS_SCHEMAS["os-data-table"];

    it("accepts the full enabled default configuration for a searchable/filterable table", () => {
      const result = schema.safeParse({
        title: "Customers",
        searchable: true,
        searchPlaceholder: "Search customers...",
        excludedFields: ["email"],
        columnVisibility: true,
        minVisibleColumns: 2,
        selectable: false,
        paginated: true,
        pageParam: "customers_page",
      });
      expect(result.success).toBe(true);
    });

    it("accepts a selectable table with selectionActions", () => {
      const result = schema.safeParse({
        title: "Customers",
        searchable: false,
        filterable: false,
        columnVisibility: false,
        selectable: true,
        selectionActions: [
          { items: [{ label: "Edit", action: { type: "edit" } }] },
          {
            label: "Danger zone",
            items: [
              { label: "Delete", tone: "destructive", action: { type: "delete" } },
            ],
          },
        ],
        paginated: false,
      });
      expect(result.success).toBe(true);
    });

    it("requires selectionActions when selectable is true", () => {
      const result = schema.safeParse({
        title: "Customers",
        searchable: false,
        filterable: false,
        columnVisibility: false,
        selectable: true,
        paginated: false,
      });
      expect(result.success).toBe(false);
    });

    it("rejects a selection action outside the edit/delete vocabulary", () => {
      const result = schema.safeParse({
        title: "Customers",
        selectable: true,
        selectionActions: [
          { items: [{ label: "View", action: { type: "navigate", url: "/x" } }] },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("accepts a declarative navigate/edit/delete actions column", () => {
      const result = schema.safeParse({
        title: "Orders",
        searchable: false,
        filterable: false,
        columnVisibility: false,
        selectable: false,
        paginated: false,
        actions: [
          {
            items: [
              { label: "View", action: { type: "navigate", url: "/os/sales/orders/{name}" } },
              { label: "Edit", action: { type: "edit" } },
            ],
          },
          {
            items: [{ label: "Delete", tone: "destructive", action: { type: "delete" } }],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects an action outside the navigate/edit/delete vocabulary", () => {
      const result = schema.safeParse({
        title: "Orders",
        actions: [
          { items: [{ label: "Archive", action: { type: "archive" } }] },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("requires searchPlaceholder when searchable is true", () => {
      const result = schema.safeParse({
        title: "Orders",
        searchable: true,
      });
      expect(result.success).toBe(false);
    });

    it("requires column visibility config when columnVisibility is true", () => {
      const result = schema.safeParse({
        title: "Orders",
        columnVisibility: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects an unrecognised prop key (.strict())", () => {
      const result = schema.safeParse({
        title: "Customers",
        notARealProp: true,
      });
      expect(result.success).toBe(false);
    });

    it("accepts a column with badgeCategory and compulsory when the table enables the column picker", () => {
      const result = schema.safeParse({
        title: "Orders",
        searchable: true,
        searchPlaceholder: "Search orders...",
        columnVisibility: true,
        minVisibleColumns: 2,
        selectable: false,
        paginated: false,
        columns: [
          {
            field: "status",
            label: "Status",
            format: "badge",
            badgeCategory: "sales",
            compulsory: true,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects an unrecognised badgeCategory", () => {
      const result = schema.safeParse({
        columns: [
          {
            field: "status",
            label: "Status",
            format: "badge",
            badgeCategory: "not-a-real-category",
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects the old badgeTones field - replaced by badgeCategory (.strict())", () => {
      const result = schema.safeParse({
        columns: [
          {
            field: "status",
            label: "Status",
            format: "badge",
            badgeTones: { open: "bg-info/10" },
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("accepts a column with a non-empty textStyle", () => {
      const result = schema.safeParse({
        searchable: false,
        filterable: false,
        columnVisibility: false,
        selectable: false,
        paginated: false,
        columns: [
          { field: "name", label: "Order", textStyle: ["bold", "underline"] },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty textStyle array", () => {
      const result = schema.safeParse({
        selectable: false,
        columns: [{ field: "name", label: "Order", textStyle: [] }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects an unrecognised textStyle value", () => {
      const result = schema.safeParse({
        selectable: false,
        columns: [{ field: "name", label: "Order", textStyle: ["strikethrough"] }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("os-dynamic-badge", () => {
    const schema = COMPONENT_PROPS_SCHEMAS["os-dynamic-badge"];

    it("accepts styling and category props supported by the component", () => {
      const result = schema.safeParse({
        content: "Open",
        category: "sales",
        variant: "outline",
        className: "capitalize",
      });
      expect(result.success).toBe(true);
    });

    it("accepts every ERPNext badge category", () => {
      for (const category of [
        "docstatus",
        "job",
        "payment",
        "sales",
        "stock",
        "project",
        "hr",
        "manufacturing",
        "generic",
      ]) {
        expect(schema.safeParse({ content: "Open", category }).success).toBe(
          true,
        );
      }
    });

    it("rejects an unrecognised category", () => {
      expect(
        schema.safeParse({ content: "Open", category: "not-a-real-category" })
          .success,
      ).toBe(false);
    });
  });

  describe("os-filter-bar", () => {
    const schema = COMPONENT_PROPS_SCHEMAS["os-filter-bar"];

    it("accepts resetPageParams alongside filters", () => {
      const result = schema.safeParse({
        filters: [
          {
            id: "group",
            type: "text",
            label: "Group",
            searchParam: "customer_group",
          },
        ],
        resetPageParams: ["customers_page", "orders_page"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects an unrecognised prop key (.strict())", () => {
      const result = schema.safeParse({ filters: [], notARealProp: true });
      expect(result.success).toBe(false);
    });
  });
});
