import { describe, expect, it } from "vitest";

import { COMPONENT_PROPS_SCHEMAS } from "@/config/component-props-schema";

describe("component-props-schema", () => {
  describe("os-kpi", () => {
    const schema = COMPONENT_PROPS_SCHEMAS["os-kpi"];

    it("accepts a fully valid literal props object", () => {
      const result = schema.safeParse({
        title: "Total Sales",
        icon: "DollarSign",
        format: "currency",
        trendPolarity: "negative",
        borderTone: "success",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an icon name outside the curated KPI_ICON_NAMES set", () => {
      const result = schema.safeParse({ title: "Total Sales", icon: "NotARealIcon" });
      expect(result.success).toBe(false);
    });

    it("rejects a wrong-typed field (trend as a string, not number|null)", () => {
      const result = schema.safeParse({ title: "Total Sales", trend: "up" });
      expect(result.success).toBe(false);
    });

    it("rejects an unrecognised prop key (.strict())", () => {
      const result = schema.safeParse({ title: "Total Sales", notARealProp: true });
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
          { field: "profit", label: "Profit", type: "bar", color: "var(--chart-2)" },
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

    it("accepts pageParam alongside the existing props", () => {
      const result = schema.safeParse({ title: "Customers", pageParam: "customers_page" });
      expect(result.success).toBe(true);
    });

    it("accepts searchParam and pageSizeParam", () => {
      const result = schema.safeParse({
        title: "Orders",
        searchParam: "orders_search",
        pageSizeParam: "orders_page_size",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an unrecognised prop key (.strict())", () => {
      const result = schema.safeParse({ title: "Customers", notARealProp: true });
      expect(result.success).toBe(false);
    });

    it("accepts a column with badgeCategory and filterParam", () => {
      const result = schema.safeParse({
        title: "Orders",
        columns: [
          {
            field: "status",
            label: "Status",
            format: "badge",
            badgeCategory: "sales",
            filterable: true,
            filterParam: "orders_filter_status",
            filterOptions: ["Draft", "Completed"],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects an unrecognised badgeCategory", () => {
      const result = schema.safeParse({
        columns: [{ field: "status", label: "Status", format: "badge", badgeCategory: "not-a-real-category" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects the old badgeTones field - replaced by badgeCategory (.strict())", () => {
      const result = schema.safeParse({
        columns: [{ field: "status", label: "Status", format: "badge", badgeTones: { open: "bg-info/10" } }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("os-dynamic-badge", () => {
    const schema = COMPONENT_PROPS_SCHEMAS["os-dynamic-badge"];

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
        expect(schema.safeParse({ content: "Open", category }).success).toBe(true);
      }
    });

    it("rejects an unrecognised category", () => {
      expect(schema.safeParse({ content: "Open", category: "not-a-real-category" }).success).toBe(false);
    });
  });

  describe("os-filter-bar", () => {
    const schema = COMPONENT_PROPS_SCHEMAS["os-filter-bar"];

    it("accepts resetPageParams alongside filters", () => {
      const result = schema.safeParse({
        filters: [{ id: "group", type: "text", label: "Group", searchParam: "customer_group" }],
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
