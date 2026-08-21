import { OsCard } from "@/components/registry/card";
import { OsChart } from "@/components/registry/chart";
import { OsDataTableView } from "@/components/registry/data-table/data-table-view";
import { OsFilterBar } from "@/components/registry/filter-bar";
import { OsKpi } from "@/components/registry/kpi";
import { PageHeader } from "@/components/registry/page-header";
import { OSPeriodToggle } from "@/components/registry/period-toggle";
import { COMPONENT_PROPS_SCHEMAS } from "@/config/component-props-schema";
import type { ComponentType, LayoutType } from "@/types/runtime/node";
import type { ComponentRegistry, ComponentRegistryEntry } from "@/types/runtime/registry";

export type { ComponentCapabilities, ComponentRegistry, ComponentRegistryEntry } from "@/types/runtime/registry";

/**
 * The vocabulary a future AI system reads: a stable semantic `type`, the real
 * React component it resolves to, a plain-English `description`, and
 * (optional) the prop name a node's rendered `children` are passed as. See
 * `types/runtime/registry.ts` for the `ComponentRegistryEntry` contract
 * itself.
 *
 * Round 4 note: earlier rounds kept `os-chart`/`os-data-table` per-feature,
 * reasoning that a dashboard's Sales Overview chart and Customers'
 * Acquisition chart were "genuinely different components." They no longer
 * are, in the sense that matters here - both are now driven by a declarative
 * `series`/`columns` spec (plain data, not React components or TanStack
 * `ColumnDef` functions), so ONE generic `OsChart`/`OsDataTableView`
 * implementation covers both without forcing an artificial abstraction. That
 * removes the reason a per-page registry ever existed: every real component
 * this runtime has today lives in this one base registry, and the renderer
 * still just takes whichever registry its caller passes in (see
 * `ui-renderer.tsx`) - nothing stops a future genuinely-bespoke component
 * from needing its own registry again, this file just doesn't have one
 * today.
 */

/** Last-registry-wins per key - the same merge semantics this repo's own
 * nav-contribution/`ProductExtension` pattern already established
 * (`interface/docs/CONNECTOR_TO_BASE_UI_COMPOSITION.md`), not a new convention. */
export function mergeRegistries(...registries: ComponentRegistry[]): ComponentRegistry {
  return Object.assign({}, ...registries);
}

/** Generic, business-agnostic components every feature can use as-is. */
/** Every layout container type a generic, non-header component may sit
 * directly under, given today's vocabulary (`section` behaves identically to
 * `stack` for placement purposes - see `layout-registry.ts`). */
const ANY_CONTAINER: LayoutType[] = ["grid", "stack", "section"];

export const baseComponentRegistry: ComponentRegistry = {
  "os-page-header": {
    type: "os-page-header",
    component: PageHeader,
    description: "Page title, optional subtitle, and a right-aligned action slot. Used once per page.",
    name: "Page Header",
    category: "page",
    ai: { exposed: true },
    childrenSlot: "action",
    capabilities: { movable: false, resizable: false },
    allowedParents: ["stack", "section"],
    supportsChildren: true,
    requiredFields: ["title"],
    propsSchema: COMPONENT_PROPS_SCHEMAS["os-page-header"],
  },
  "os-card": {
    type: "os-card",
    component: OsCard,
    description: "Generic chrome wrapper (title + content) for composing a single child component.",
    name: "Card",
    category: "layout",
    ai: { exposed: true },
    childrenSlot: "children",
    capabilities: { movable: true, resizable: true },
    allowedParents: [...ANY_CONTAINER, "inline"],
    supportsChildren: true,
    propsSchema: COMPONENT_PROPS_SCHEMAS["os-card"],
  },
  "os-kpi": {
    type: "os-kpi",
    component: OsKpi,
    description:
      "A single business metric: a raw value (optionally formatted as number/currency/percent) plus an optional already-computed trend delta.",
    name: "KPI",
    category: "data-display",
    ai: { exposed: true },
    capabilities: { movable: true, resizable: true },
    allowedParents: ANY_CONTAINER,
    supportsChildren: false,
    requiredFields: ["title", "value"],
    propsSchema: COMPONENT_PROPS_SCHEMAS["os-kpi"],
  },
  "os-data-table": {
    type: "os-data-table",
    component: OsDataTableView,
    description:
      "Configurable data table: a declarative column spec (field/label/format/sortable/filterable) plus resolved rows - search, filter, column visibility, selection, and pagination are each a boolean prop.",
    name: "Data Table",
    category: "data-display",
    ai: { exposed: true },
    capabilities: { movable: true, resizable: true },
    allowedParents: ANY_CONTAINER,
    supportsChildren: false,
    requiredFields: ["columns", "rows"],
    propsSchema: COMPONENT_PROPS_SCHEMAS["os-data-table"],
  },
  "os-chart": {
    type: "os-chart",
    component: OsChart,
    description:
      "A composed chart (bar/line/area series over a shared x-axis) driven by a declarative series spec plus resolved rows.",
    name: "Chart",
    category: "data-display",
    ai: { exposed: true },
    capabilities: { movable: true, resizable: true },
    allowedParents: ANY_CONTAINER,
    supportsChildren: false,
    requiredFields: ["x", "series", "rows"],
    propsSchema: COMPONENT_PROPS_SCHEMAS["os-chart"],
  },
  "os-filter-bar": {
    type: "os-filter-bar",
    component: OsFilterBar,
    description: "One or more filter controls (select/text/date-range), each bound to its own URL search param.",
    name: "Filter Bar",
    category: "filtering",
    ai: { exposed: true },
    capabilities: { movable: true, resizable: false },
    allowedParents: [...ANY_CONTAINER, "inline"],
    supportsChildren: false,
    requiredFields: ["filters"],
    propsSchema: COMPONENT_PROPS_SCHEMAS["os-filter-bar"],
  },
  "os-period-toggle": {
    type: "os-period-toggle",
    component: OSPeriodToggle,
    description: "Period selector driven by the page's own `?period=` URL query param.",
    name: "Period Toggle",
    category: "filtering",
    ai: { exposed: true },
    capabilities: { movable: true, resizable: false },
    allowedParents: [...ANY_CONTAINER, "inline"],
    supportsChildren: false,
    propsSchema: COMPONENT_PROPS_SCHEMAS["os-period-toggle"],
  },
};

export function resolveComponent(registry: ComponentRegistry, type: string): ComponentRegistryEntry | undefined {
  return registry[type as ComponentType];
}

/** The subset of a registry Ask Alaiy may reason about and place - not
 * every *registered* (resolvable/renderable) entry is *AI-exposed*. An
 * entry that omits `ai` entirely (an ad hoc override, a test fixture)
 * is excluded by the same governance-safe default `ComponentCapabilities`
 * already uses. */
export function listAiExposedComponents(registry: ComponentRegistry): ComponentRegistryEntry[] {
  return Object.values(registry).filter((entry): entry is ComponentRegistryEntry => Boolean(entry?.ai?.exposed));
}
