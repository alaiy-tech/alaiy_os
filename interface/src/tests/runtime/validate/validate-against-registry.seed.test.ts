import { describe, expect, it } from "vitest";

import "@/runtime/data/sources"; // registers every real data source as a side effect, same as resolve-page.tsx

import { getDataSource } from "@/runtime/data/registry";
import { baseComponentRegistry } from "@/runtime/registry/component-registry";
import { validateAgainstRegistry } from "@/runtime/validate/validate-against-registry";
import { HEADLESS_CUSTOMERS_PAGE, HEADLESS_DASHBOARD_PAGE } from "@/seeds/pages/seed-data";

/**
 * A regression test, not a unit test: runs the registry-aware validation
 * gate `resolve-page.tsx` now applies to every page against the two real
 * production seed pages (`/os`, `/os/customers`) - the
 * same base registry and the same real, registered Data Source ids, no
 * fixtures. If a future edit to `seed-data.ts`, the base registry, or the
 * layout span/columns tables ever makes either real page fail this gate,
 * this test catches it without needing a live server or a Frappe session.
 */
describe("validateAgainstRegistry against the real seed pages", () => {
  const isDataSourceRegistered = (id: string) => getDataSource(id) !== undefined;

  it("HEADLESS_DASHBOARD_PAGE passes with zero errors", () => {
    expect(
      validateAgainstRegistry(HEADLESS_DASHBOARD_PAGE, {
        componentRegistry: baseComponentRegistry,
        isDataSourceRegistered,
      }),
    ).toEqual([]);
  });

  it("HEADLESS_CUSTOMERS_PAGE passes with zero errors", () => {
    expect(
      validateAgainstRegistry(HEADLESS_CUSTOMERS_PAGE, {
        componentRegistry: baseComponentRegistry,
        isDataSourceRegistered,
      }),
    ).toEqual([]);
  });
});
