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
});
