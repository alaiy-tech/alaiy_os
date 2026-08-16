"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/primitive/button";
import { applyUIAction } from "@/ui-runtime/actions/mutations";
import type { ComponentRegistry } from "@/ui-runtime/registry/component-registry";
import { UIRenderer } from "@/ui-runtime/renderer/ui-renderer";
import type { UIPageDefinition } from "@/ui-runtime/schema/page";

/** Dev-only proof that the page is actually driven by `definition`, not
 * hardcoded JSX. Two independent toggles, each running real `applyUIAction`
 * calls and re-rendering from the resulting (new, immutable) definition:
 *
 * - "Hide sales chart": REMOVE_COMPONENT.
 * - "Move Recent Orders above Sales Overview": MOVE_COMPONENT (crossing
 *   container types - Stack to Grid) followed by UPDATE_COMPONENT (so the
 *   moved table spans the full 12-column row instead of collapsing to one
 *   grid column) - two chained actions, proving composability, not just that
 *   a single action can render.
 *
 * Registered as the `headless` page's `render` override in
 * `ui-runtime/page-features.tsx`, so both the static `/os/headless` route
 * and (were it ever reached that way) the dynamic `/os/[...page]` catch-all
 * use the exact same component. */
export function HeadlessDashboardClient({
  definition,
  data,
  registry,
}: {
  definition: UIPageDefinition;
  data: Record<string, unknown>;
  registry: ComponentRegistry;
}) {
  const [chartHidden, setChartHidden] = useState(false);
  const [ordersMoved, setOrdersMoved] = useState(false);

  const activeDefinition = useMemo(() => {
    let current = definition;

    if (chartHidden) {
      current = applyUIAction(current, {
        type: "REMOVE_COMPONENT",
        componentId: "sales-overview-chart",
      });
    }

    if (ordersMoved) {
      current = applyUIAction(current, {
        type: "MOVE_COMPONENT",
        componentId: "recent-orders-table",
        newParentId: "kpi-chart-row",
        index: 0,
      });
      current = applyUIAction(current, {
        type: "UPDATE_COMPONENT",
        componentId: "recent-orders-table",
        patch: { layout: { span: { xl: 12 } } },
      });
    }

    return current;
  }, [definition, chartHidden, ordersMoved]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-muted-foreground/40 border-dashed px-3 py-2 text-xs">
        <span className="text-muted-foreground">
          Dev-only: demonstrates <code>applyUIAction</code> producing a new UI
          definition.
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setChartHidden((hidden) => !hidden)}
          >
            {chartHidden ? "Show sales chart" : "Hide sales chart"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOrdersMoved((moved) => !moved)}
          >
            {ordersMoved
              ? "Move Recent Orders back"
              : "Move Recent Orders above Sales Overview"}
          </Button>
        </div>
      </div>
      <UIRenderer
        definition={activeDefinition}
        data={data}
        registry={registry}
      />
    </div>
  );
}
