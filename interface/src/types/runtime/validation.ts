import type { ComponentRegistry } from "./registry";

export type ValidateAgainstRegistryOptions = {
  componentRegistry: ComponentRegistry;
  /** Whether a `data` binding's `source` id is a real, registered Data
   * Source. Passed in explicitly (rather than defaulting to the live
   * `data/registry.ts`) so a caller controls exactly when that registry is
   * expected to be populated - `resolve-page.tsx` passes the live one, tests
   * pass a fixture. */
  isDataSourceRegistered: (id: string) => boolean;
};
