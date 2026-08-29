import { describe, expect, it } from "vitest";

import "@/runtime/data/sources"; // registers every real data source as a side effect, same as resolve-page.tsx

import { baseComponentRegistry } from "@/runtime/registry/component-registry";
import { getDataSource } from "@/runtime/registry/data-source-registry";
import { validateAgainstRegistry } from "@/runtime/validate/validate-against-registry";
import { HEADLESS_DASHBOARD_PAGE } from "@/seed";

/**
 * A regression test, not a unit test: runs the registry-aware validation
 * gate `resolve-page.tsx` applies to every page against the real production
 * seed page (`/os`) - the same base registry and the same real, registered
 * Data Source ids, no fixtures. If a future edit to `seed.ts`, the base
 * registry, or the layout span/columns tables ever makes it fail this gate,
 * this test catches it without needing a live server or a Frappe session.
 */
describe("validateAgainstRegistry against the real seed page", () => {
  const isDataSourceRegistered = (id: string) => getDataSource(id) !== undefined;

  it("HEADLESS_DASHBOARD_PAGE passes with zero errors", () => {
    expect(
      validateAgainstRegistry(HEADLESS_DASHBOARD_PAGE, {
        componentRegistry: baseComponentRegistry,
        isDataSourceRegistered,
      }),
    ).toEqual([]);
  });
});
