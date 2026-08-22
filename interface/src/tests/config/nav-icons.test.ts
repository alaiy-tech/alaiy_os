import { LayoutDashboard, Settings } from "lucide-react";
import { describe, expect, it } from "vitest";

import { iconName, resolveNavIcon } from "@/config/nav-icons";

describe("nav-icons", () => {
  it("resolveNavIcon resolves a known lower-kebab-case name to its component", () => {
    expect(resolveNavIcon("layout-dashboard")).toBe(LayoutDashboard);
    expect(resolveNavIcon("settings")).toBe(Settings);
  });

  it("resolveNavIcon returns undefined for an unknown or missing name", () => {
    expect(resolveNavIcon("not-a-real-icon")).toBeUndefined();
    expect(resolveNavIcon(undefined)).toBeUndefined();
    expect(resolveNavIcon(null)).toBeUndefined();
  });

  it("iconName is the reverse of resolveNavIcon for every curated icon", () => {
    expect(iconName(LayoutDashboard)).toBe("layout-dashboard");
    expect(iconName(Settings)).toBe("settings");
    const resolved = resolveNavIcon("building-2");
    expect(resolved && iconName(resolved)).toBe("building-2");
  });

  it("iconName returns undefined for a component outside the curated set", () => {
    const NotCurated = () => null;
    // biome-ignore lint/suspicious/noExplicitAny: deliberately not a real LucideIcon, to exercise the miss path.
    expect(iconName(NotCurated as any)).toBeUndefined();
  });
});
