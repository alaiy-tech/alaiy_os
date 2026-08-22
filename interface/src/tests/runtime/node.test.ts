import { describe, expect, it } from "vitest";

import { isComponentNode, isLayoutNode } from "@/runtime/node";
import type { UINode } from "@/types/runtime/node";
import type { UIPageDefinition } from "@/types/runtime/page";

describe("UI Definition schema", () => {
  it("supports a nested page definition (layout containing components containing layouts)", () => {
    const definition: UIPageDefinition = {
      id: "test-page",
      kind: "page",
      children: [
        {
          id: "root",
          kind: "layout",
          type: "stack",
          children: [
            {
              id: "header",
              kind: "component",
              type: "os-page-header",
              props: { title: "Test" },
              children: [
                {
                  id: "actions",
                  kind: "layout",
                  type: "inline",
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(definition.kind).toBe("page");
    const root = definition.children[0];
    expect(isLayoutNode(root)).toBe(true);
    if (isLayoutNode(root)) {
      const header = root.children[0];
      expect(isComponentNode(header)).toBe(true);
      if (isComponentNode(header)) {
        expect(header.children?.[0].id).toBe("actions");
      }
    }
  });

  it("allows a layout node to carry an arbitrary number of children", () => {
    const grid: UINode = {
      id: "grid",
      kind: "layout",
      type: "grid",
      columns: { base: 1, xl: 12 },
      children: [
        { id: "a", kind: "component", type: "os-kpi" },
        { id: "b", kind: "component", type: "os-kpi" },
        { id: "c", kind: "component", type: "os-kpi" },
      ],
    };

    expect(isLayoutNode(grid)).toBe(true);
    if (isLayoutNode(grid)) {
      expect(grid.children).toHaveLength(3);
    }
  });

  it("lets a component node carry a layout span constraint separately from its props", () => {
    const node: UINode = {
      id: "kpi-total-sales",
      kind: "component",
      type: "os-kpi",
      layout: { span: { base: 12, md: 6 } },
      props: { title: "Total Sales" },
      data: { value: { source: "kpis", path: "total_sales.value" } },
    };

    expect(isComponentNode(node)).toBe(true);
    if (isComponentNode(node)) {
      expect(node.layout?.span).toEqual({ base: 12, md: 6 });
      expect(node.props).toEqual({ title: "Total Sales" });
      // layout and props are structurally distinct fields - a renderer can
      // never confuse a component's placement with its data.
      expect(node.layout).not.toHaveProperty("title");
      expect(node.props).not.toHaveProperty("span");
    }
  });
});
