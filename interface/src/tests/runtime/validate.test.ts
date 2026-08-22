import { describe, expect, it } from "vitest";

import { validatePageConfig } from "@/runtime/validate";

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: "example",
    route: "/os/example",
    definition: { id: "example-page", kind: "page", children: [] },
    ...overrides,
  };
}

describe("validatePageConfig", () => {
  it("accepts a valid, minimal page config", () => {
    expect(validatePageConfig(baseConfig()).ok).toBe(true);
  });

  it("accepts a real nested tree (layout containing a component containing a layout)", () => {
    const config = baseConfig({
      definition: {
        id: "page",
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
                children: [{ id: "actions", kind: "layout", type: "inline", children: [] }],
              },
            ],
          },
        ],
      },
    });

    expect(validatePageConfig(config).ok).toBe(true);
  });

  it("accepts a component node's dataBinding/data map and layout span", () => {
    const config = baseConfig({
      definition: {
        id: "page",
        kind: "page",
        children: [
          {
            id: "kpi",
            kind: "component",
            type: "os-kpi",
            layout: { span: { base: 12, md: 6 } },
            data: { value: { source: "kpis", path: "total_orders.value" } },
          },
        ],
      },
    });

    expect(validatePageConfig(config).ok).toBe(true);
  });

  it("rejects a config missing required top-level fields", () => {
    expect(validatePageConfig({ id: "x" }).ok).toBe(false);
  });

  it("rejects a route that doesn't start with /", () => {
    expect(validatePageConfig(baseConfig({ route: "os/example" })).ok).toBe(false);
  });

  it("rejects an invalid layout node (unknown layout type)", () => {
    const config = baseConfig({
      definition: {
        id: "page",
        kind: "page",
        children: [{ id: "bad", kind: "layout", type: "not-a-real-layout", children: [] }],
      },
    });

    expect(validatePageConfig(config).ok).toBe(false);
  });

  it("rejects a component node missing an id", () => {
    const config = baseConfig({
      definition: { id: "page", kind: "page", children: [{ kind: "component", type: "os-kpi" }] },
    });

    expect(validatePageConfig(config).ok).toBe(false);
  });

  it("accepts any non-empty string as a component type - vocabulary is the registry's job, not the schema's", () => {
    const config = baseConfig({
      definition: {
        id: "page",
        kind: "page",
        children: [{ id: "custom", kind: "component", type: "totally-made-up-type" }],
      },
    });

    // Structurally valid; whether "totally-made-up-type" is a real component
    // is for the renderer/registry to decide at render time (safe fallback:
    // the "Unknown component type" placeholder), never a validation error.
    expect(validatePageConfig(config).ok).toBe(true);
  });

  it("rejects duplicate node ids anywhere in the tree", () => {
    const config = baseConfig({
      definition: {
        id: "page",
        kind: "page",
        children: [
          { id: "dupe", kind: "component", type: "os-kpi" },
          { id: "dupe", kind: "component", type: "os-card" },
        ],
      },
    });

    const result = validatePageConfig(config);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errors[0]).toContain("dupe");
    }
  });

  it("rejects a duplicate between the page's own id and a descendant node's id", () => {
    const config = baseConfig({
      definition: {
        id: "shared-id",
        kind: "page",
        children: [{ id: "shared-id", kind: "component", type: "os-kpi" }],
      },
    });

    expect(validatePageConfig(config).ok).toBe(false);
  });
});
