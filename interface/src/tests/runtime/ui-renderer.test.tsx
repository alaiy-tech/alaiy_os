import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { baseComponentRegistry, mergeRegistries } from "@/runtime/registry/component-registry";
import { UIRenderer } from "@/runtime/ui-renderer";
import type { UIPageDefinition } from "@/types/runtime/page";

const baseData: Record<string, unknown> = {
  kpis: {
    total_orders: { value: "10", delta: "+100.0% vs last month" },
  },
};

function page(children: UIPageDefinition["children"]): UIPageDefinition {
  return { id: "test-page", kind: "page", children };
}

describe("UIRenderer", () => {
  it("renders a full page definition end to end, using the base registry", () => {
    render(
      <UIRenderer
        definition={page([
          {
            id: "root",
            kind: "layout",
            type: "stack",
            children: [
              {
                id: "header",
                kind: "component",
                type: "os-page-header",
                props: { title: "Dashboard" },
              },
            ],
          },
        ])}
        data={baseData}
        registry={baseComponentRegistry}
      />,
    );

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("renders a grid layout node with multiple children", () => {
    render(
      <UIRenderer
        definition={page([
          {
            id: "row",
            kind: "layout",
            type: "grid",
            columns: { base: 1, xl: 12 },
            children: [
              {
                id: "kpi-a",
                kind: "component",
                type: "os-kpi",
                props: { title: "Total Orders" },
                data: {
                  value: { source: "kpis", path: "total_orders.value" },
                  delta: { source: "kpis", path: "total_orders.delta" },
                },
              },
              {
                id: "kpi-b",
                kind: "component",
                type: "os-kpi",
                props: { title: "Other Metric", value: "—" },
              },
            ],
          },
        ])}
        data={baseData}
        registry={baseComponentRegistry}
      />,
    );

    expect(screen.getByText("Total Orders")).toBeInTheDocument();
    expect(screen.getByText("Other Metric")).toBeInTheDocument();
  });

  it("resolves a kpi node's DataSource refs into the real StatCard's rendered value", () => {
    render(
      <UIRenderer
        definition={page([
          {
            id: "kpi-total-orders",
            kind: "component",
            type: "os-kpi",
            props: { title: "Total Orders", icon: "ShoppingBag" },
            data: {
              value: { source: "kpis", path: "total_orders.value" },
              delta: { source: "kpis", path: "total_orders.delta" },
            },
          },
        ])}
        data={baseData}
        registry={baseComponentRegistry}
      />,
    );

    expect(screen.getByText("Total Orders")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders a type registered only by a feature-specific registry merged on top of the base one", () => {
    function StubChart({ label }: { label: string }) {
      return <div data-testid="stub-chart">{label}</div>;
    }

    const featureRegistry = mergeRegistries(baseComponentRegistry, {
      "os-chart": {
        type: "os-chart",
        component: StubChart,
        description: "test-only stub",
      },
    });

    render(
      <UIRenderer
        definition={page([
          {
            id: "chart",
            kind: "component",
            type: "os-chart",
            props: { label: "Stub Chart" },
          },
        ])}
        data={baseData}
        registry={featureRegistry}
      />,
    );

    expect(screen.getByTestId("stub-chart")).toHaveTextContent("Stub Chart");
  });

  it("renders a feature's os-data-table entry, receiving only row data through `data` (columns are a static import, not a DataSourceRef)", () => {
    // Mirrors the real pattern (`features/dashboard/recent-orders-table.tsx`):
    // column defs carry render functions, which can never cross a real
    // Server -> Client Component boundary, so they're closed over locally by
    // the feature's own registry component instead of bound via `data`.
    function StubTable({ data }: { data: { name: string }[] }) {
      return <div data-testid="stub-table">{data.length} rows</div>;
    }

    const featureRegistry = mergeRegistries(baseComponentRegistry, {
      "os-data-table": {
        type: "os-data-table",
        component: StubTable,
        description: "test-only stub",
      },
    });

    render(
      <UIRenderer
        definition={page([
          {
            id: "table",
            kind: "component",
            type: "os-data-table",
            data: { data: { source: "rows" } },
          },
        ])}
        data={{ rows: [{ name: "Acme" }, { name: "Globex" }] }}
        registry={featureRegistry}
      />,
    );

    expect(screen.getByTestId("stub-table")).toHaveTextContent("2 rows");
  });

  it("renders nested structures (component node with layout-node children in its childrenSlot)", () => {
    render(
      <UIRenderer
        definition={page([
          {
            id: "header",
            kind: "component",
            type: "os-page-header",
            props: { title: "Header Title" },
            children: [
              {
                id: "action-card",
                kind: "component",
                type: "os-card",
                props: { title: "Test Action" },
              },
            ],
          },
        ])}
        data={baseData}
        registry={baseComponentRegistry}
      />,
    );

    expect(screen.getByRole("heading", { name: "Header Title" })).toBeInTheDocument();
    expect(screen.getByText("Test Action")).toBeInTheDocument();
  });

  it("fails safely on an unknown component type - placeholder only, does not throw", () => {
    expect(() =>
      render(
        <UIRenderer
          definition={page([
            // biome-ignore lint/suspicious/noExplicitAny: deliberately an invalid type, to exercise the fallback.
            { id: "bad", kind: "component", type: "totally-fake" as any },
          ])}
          data={baseData}
          registry={baseComponentRegistry}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByText(/Unknown component type/)).toBeInTheDocument();
    expect(screen.getByText("totally-fake")).toBeInTheDocument();
  });

  it("fails safely on an unknown layout type - placeholder only, does not throw, siblings still render", () => {
    render(
      <UIRenderer
        definition={page([
          {
            id: "bad-layout",
            kind: "layout",
            // biome-ignore lint/suspicious/noExplicitAny: deliberately an invalid type, to exercise the fallback.
            type: "totally-fake" as any,
            children: [],
          },
          {
            id: "header",
            kind: "component",
            type: "os-page-header",
            props: { title: "Still Renders" },
          },
        ])}
        data={baseData}
        registry={baseComponentRegistry}
      />,
    );

    expect(screen.getByText(/Unknown layout type/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Still Renders" })).toBeInTheDocument();
  });
});
