import { HomeTiles } from "@/app/(app)/home/home-tiles";
import { SalesPerformance } from "@/app/(app)/home/sales-performance";
import { NeedsAttention } from "@/app/(app)/home/needs-attention";
import { MyStores } from "@/app/(app)/home/my-stores";
import { RecentActivity } from "@/app/(app)/home/recent-activity";
import type { ConnectorStatus, HomeAlert, ImportJob } from "@/lib/backend/types";
import type { HomeOverview as Overview } from "@/lib/home/overview";

/**
 * Everything under the composer on Home: the glance, in the order a seller
 * takes it.
 *
 * Figures, then the two things that are asking for attention side by side —
 * the shape of the month and the list of what is wrong with it — then the
 * stores those figures came from, then what has happened lately. The chart
 * and the alerts share a row because they answer the same question from two
 * directions, and reading one usually means wanting the other.
 *
 * Server-rendered apart from `NeedsAttention`, which is a client component
 * only so a dismissal can hide its row before the round trip finishes.
 */

export function HomeOverview({
  overview,
  alerts,
  connectors,
  listings,
  currentImport,
  currency,
  thisLabel,
  lastLabel,
  today,
}: {
  overview: Overview;
  alerts: HomeAlert[];
  connectors: ConnectorStatus[];
  listings: number | null;
  currentImport: ImportJob | null;
  currency: string | null;
  thisLabel: string;
  lastLabel: string;
  today: Date;
}) {
  return (
    <div className="space-y-5">
      <HomeTiles
        sales={overview.sales}
        orderCount={overview.orderCount}
        currency={currency}
        listings={listings}
        connectors={connectors}
        comparable={overview.comparable}
      />

      {/* Nothing has ever arrived. A chart of two empty months and a row of
          stores that have sold nothing is a worse answer than one sentence. */}
      {overview.empty ? (
        <div className="rounded-lg border border-line bg-white px-4 py-8 text-center">
          <p className="text-body text-muted">
            No orders have arrived from your channels yet. Your sales appear here
            as soon as the first import finishes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <SalesPerformance
            thisMonth={overview.thisMonth}
            lastMonth={overview.lastMonth}
            currency={currency}
            thisLabel={thisLabel}
            lastLabel={lastLabel}
          />
          <NeedsAttention alerts={alerts} />
        </div>
      )}

      <MyStores
        connectors={connectors}
        byChannel={overview.byChannel}
        currency={currency}
        comparable={overview.comparable}
      />

      <RecentActivity
        connectors={connectors}
        currentImport={currentImport}
        byChannel={overview.byChannel}
        today={today}
      />
    </div>
  );
}
