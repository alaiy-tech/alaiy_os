import type { ReactNode } from "react";

import type { UIPageDefinition } from "./page";
import type { ComponentRegistry } from "./registry";

export type PageFeatureBinding = {
  /** Optional override for how the definition is rendered. Nothing needs
   * one today - `/os/dashboard`'s dev-only mutation-demo render override
   * (a proof that `applyUIAction` works, from when this page lived at the
   * test-only `/os/headless` route) was retired now that this is a real
   * production page; see `obsolete/` for that component if it's ever needed
   * again. Everything renders through the plain `<UIRenderer>` the dynamic
   * route defaults to. */
  render?: (definition: UIPageDefinition, data: Record<string, unknown>, registry: ComponentRegistry) => ReactNode;
};
