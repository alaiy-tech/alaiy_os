import { describe, expect, it } from "vitest";

import {
  baseComponentRegistry,
  type ComponentRegistry,
  type ComponentRegistryEntry,
} from "@/runtime/registry/component-registry";
import { validateAgainstRegistry } from "@/runtime/validate/validate-against-registry";
import type { PageConfigFile } from "@/types/runtime/page-config";

const REGISTERED_SOURCES = new Set(["kpis", "dashboard.overview"]);
const isDataSourceRegistered = (id: string) => REGISTERED_SOURCES.has(id);

function page(children: PageConfigFile["definition"]["children"]): PageConfigFile {
  return {
    id: "page",
    route: "/os/page",
    definition: { id: "page-root", kind: "page", children },
  };
}

describe("validateAgainstRegistry", () => {
  it("accepts a well-formed page against the base registry", () => {
    const config = page([
      {
        id: "root",
        kind: "layout",
        type: "stack",
        children: [
          {
            id: "kpi",
            kind: "component",
            type: "os-kpi",
            props: { title: "Total Sales" },
            data: { value: { source: "kpis", path: "total" } },
          },
        ],
      },
    ]);

    expect(
      validateAgainstRegistry(config, {
        componentRegistry: baseComponentRegistry,
        isDataSourceRegistered,
      }),
    ).toEqual([]);
  });

  it("flags a component type that isn't in the registry", () => {
    // Simulates an untrusted/DB-sourced definition - `type` is only a plain
    // string until `validatePageConfig` narrows it (see that module's doc
    // comment), so a real caller can hand this function a type the closed
    // `ComponentType` union doesn't know about at compile time.
    const config = page([
      {
        id: "mystery",
        kind: "component",
        type: "totally-made-up-type",
      } as unknown as PageConfigFile["definition"]["children"][number],
    ]);

    const errors = validateAgainstRegistry(config, {
      componentRegistry: baseComponentRegistry,
      isDataSourceRegistered,
    });
    expect(errors).toEqual([expect.stringContaining('unknown component type "totally-made-up-type"')]);
  });

  it("flags a component placed under a parent type not in its allowedParents", () => {
    const registry: ComponentRegistry = {
      "os-kpi": {
        ...(baseComponentRegistry["os-kpi"] as ComponentRegistryEntry),
        allowedParents: ["grid"],
      },
    };
    const config = page([
      {
        id: "root",
        kind: "layout",
        type: "inline",
        children: [
          {
            id: "kpi",
            kind: "component",
            type: "os-kpi",
            props: { title: "x", value: 1 },
          },
        ],
      },
    ]);

    const errors = validateAgainstRegistry(config, {
      componentRegistry: registry,
      isDataSourceRegistered,
    });
    expect(errors).toEqual([expect.stringContaining('may not be placed directly under "inline"')]);
  });

  it("does not constrain a component sitting at the page's own root (no parent to check)", () => {
    const registry: ComponentRegistry = {
      "os-kpi": {
        ...(baseComponentRegistry["os-kpi"] as ComponentRegistryEntry),
        allowedParents: ["grid"],
      },
    };
    const config = page([
      {
        id: "kpi",
        kind: "component",
        type: "os-kpi",
        props: { title: "x", value: 1 },
      },
    ]);

    expect(
      validateAgainstRegistry(config, {
        componentRegistry: registry,
        isDataSourceRegistered,
      }),
    ).toEqual([]);
  });

  it("flags children on a component whose registry entry has supportsChildren: false", () => {
    const config = page([
      {
        id: "kpi",
        kind: "component",
        type: "os-kpi",
        props: { title: "x", value: 1 },
        children: [
          {
            id: "nested",
            kind: "component",
            type: "os-kpi",
            props: { title: "y", value: 2 },
          },
        ],
      },
    ]);

    const errors = validateAgainstRegistry(config, {
      componentRegistry: baseComponentRegistry,
      isDataSourceRegistered,
    });
    expect(errors.some((error) => error.includes('"os-kpi" does not support children'))).toBe(true);
  });

  it("flags a component missing one of its registry-declared requiredFields", () => {
    const config = page([
      {
        id: "kpi",
        kind: "component",
        type: "os-kpi",
        props: { title: "Total Sales" },
      },
    ]);

    const errors = validateAgainstRegistry(config, {
      componentRegistry: baseComponentRegistry,
      isDataSourceRegistered,
    });
    expect(errors).toEqual([expect.stringContaining("missing required field(s): value")]);
  });

  it("treats a requiredField supplied via a data binding (not a literal prop) as satisfied", () => {
    const config = page([
      {
        id: "kpi",
        kind: "component",
        type: "os-kpi",
        props: { title: "Total Sales" },
        data: { value: { source: "kpis" } },
      },
    ]);

    expect(
      validateAgainstRegistry(config, {
        componentRegistry: baseComponentRegistry,
        isDataSourceRegistered,
      }),
    ).toEqual([]);
  });

  it("flags a data binding whose source was never registered", () => {
    const config = page([
      {
        id: "kpi",
        kind: "component",
        type: "os-kpi",
        props: { title: "x" },
        data: { value: { source: "does-not-exist" } },
      },
    ]);

    const errors = validateAgainstRegistry(config, {
      componentRegistry: baseComponentRegistry,
      isDataSourceRegistered,
    });
    expect(errors).toEqual([expect.stringContaining('unregistered data source "does-not-exist"')]);
  });

  it("flags an out-of-range layout.span value", () => {
    const config = page([
      {
        id: "kpi",
        kind: "component",
        type: "os-kpi",
        props: { title: "x", value: 1 },
        layout: { span: { xl: 9 } },
      },
    ]);

    const errors = validateAgainstRegistry(config, {
      componentRegistry: baseComponentRegistry,
      isDataSourceRegistered,
    });
    expect(errors).toEqual([expect.stringContaining("layout.span.xl = 9")]);
  });

  it("flags an out-of-range grid columns value", () => {
    const config = page([
      {
        id: "grid",
        kind: "layout",
        type: "grid",
        columns: { md: 5 },
        children: [],
      },
    ]);

    const errors = validateAgainstRegistry(config, {
      componentRegistry: baseComponentRegistry,
      isDataSourceRegistered,
    });
    expect(errors).toEqual([expect.stringContaining("columns.md = 5")]);
  });
});
