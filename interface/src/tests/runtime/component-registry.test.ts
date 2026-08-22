import { describe, expect, it } from "vitest";

import { baseComponentRegistry, mergeRegistries, resolveComponent } from "@/runtime/component-registry";
import { layoutRegistry, resolveLayout } from "@/runtime/layout-registry";

describe("component registry", () => {
  it("resolves every base component type to a real component", () => {
    for (const type of Object.keys(baseComponentRegistry)) {
      const entry = resolveComponent(baseComponentRegistry, type);
      expect(entry).toBeDefined();
      expect(entry?.component).toBeTruthy();
      expect(typeof entry?.description).toBe("string");
      expect(entry?.description.length).toBeGreaterThan(0);
    }
  });

  it("resolves a specific known type (os-kpi) to its component", () => {
    const entry = resolveComponent(baseComponentRegistry, "os-kpi");
    expect(entry).toBeDefined();
    expect(entry?.type).toBe("os-kpi");
  });

  it("fails predictably (returns undefined, does not throw) for an unknown component type", () => {
    expect(() => resolveComponent(baseComponentRegistry, "does-not-exist")).not.toThrow();
    expect(resolveComponent(baseComponentRegistry, "does-not-exist")).toBeUndefined();
  });

  it("every base entry declares capabilities, allowedParents, and supportsChildren (the machine-readable contract)", () => {
    for (const type of Object.keys(baseComponentRegistry)) {
      const entry = resolveComponent(baseComponentRegistry, type);
      expect(entry?.capabilities).toBeDefined();
      expect(entry?.allowedParents?.length).toBeGreaterThan(0);
      expect(typeof entry?.supportsChildren).toBe("boolean");
    }
  });

  it("supportsChildren agrees with the presence of a childrenSlot", () => {
    for (const type of Object.keys(baseComponentRegistry)) {
      const entry = resolveComponent(baseComponentRegistry, type);
      expect(entry?.supportsChildren).toBe(Boolean(entry?.childrenSlot));
    }
  });

  it("mergeRegistries composes a feature registry on top of the base one, feature entries winning on key collision", () => {
    const merged = mergeRegistries(baseComponentRegistry, {
      "os-kpi": {
        type: "os-kpi",
        component: () => null,
        description: "feature override",
      },
      "os-chart": {
        type: "os-chart",
        component: () => null,
        description: "dashboard-only type",
      },
    });

    // base-only entries survive the merge untouched
    expect(resolveComponent(merged, "os-page-header")).toBe(baseComponentRegistry["os-page-header"]);
    // a feature entry that collides with a base key wins (last-registry-wins)
    expect(resolveComponent(merged, "os-kpi")?.description).toBe("feature override");
    // a feature-only entry is present too
    expect(resolveComponent(merged, "os-chart")?.description).toBe("dashboard-only type");
    // the base registry itself is never mutated by merging
    expect(baseComponentRegistry["os-kpi"]?.description).not.toBe("feature override");
  });
});

describe("layout registry", () => {
  it("resolves every known layout type to a className resolver", () => {
    for (const type of Object.keys(layoutRegistry)) {
      const layout = resolveLayout(type);
      expect(layout).toBeDefined();
      expect(typeof layout?.className({})).toBe("string");
    }
  });

  it("resolves a specific known type (grid) with columns applied", () => {
    const layout = resolveLayout("grid");
    expect(layout).toBeDefined();
    const className = layout?.className({ columns: { base: 1, xl: 12 } }) ?? "";
    expect(className).toContain("grid-cols-1");
    expect(className).toContain("xl:grid-cols-12");
  });

  it("fails predictably (returns undefined, does not throw) for an unknown layout type", () => {
    expect(() => resolveLayout("does-not-exist")).not.toThrow();
    expect(resolveLayout("does-not-exist")).toBeUndefined();
  });
});
