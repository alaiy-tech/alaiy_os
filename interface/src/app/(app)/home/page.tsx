import { requireOnboardedSession } from "@/lib/auth/dal";
import { loadHomeTiles } from "@/lib/backend/dashboard";
import { loadHomeDashboard } from "@/lib/backend/home";
import { EXPORT_LIMIT, listOrders } from "@/lib/backend/orders";
import { loadListings } from "@/lib/backend/listings";
import { listConnectors } from "@/lib/backend/connectors";
import { openingMessage } from "@/lib/ask/greeting";
import { suggestionsFor } from "@/lib/ask/suggestions";
import { ChatWorkspace } from "@/components/ask/chat-workspace";
import { isImporting, loadCurrentImport } from "@/lib/backend/imports";
import { HomeOverview } from "@/app/(app)/home/home-overview";
import { monthWindows, overviewFrom, summariseOrders } from "@/lib/home/overview";
import type { ConnectorStatus } from "@/lib/backend/types";

export const metadata = { title: "Ask Alaiy" };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Home is Ask Alaiy: the question, and the glance underneath it.
 *
 * Which chat is open comes from `?chat=`, so a conversation has a URL — it
 * survives a reload, and can be reopened from the rail tomorrow. That
 * resolution is the layout's, not this page's, because the rail that lists
 * the chats is rendered there; see `components/ask/chat-nav.tsx`. No session
 * is created here, or every visit would leave an empty chat in the rail.
 *
 * ## One order fetch, five figures
 *
 * The tiles, the chart and the per-store cards all come out of a single
 * `listOrders` covering this month and the same days of last month. There is
 * no time-series or per-channel-revenue method to call, and splitting these
 * into separate reads would mean several definitions of "this month" that
 * could disagree on screen. `lib/home/overview.ts` is the one pass over it.
 *
 * None of the reads here are fatal. The greeting has a fallback, the import
 * check only decides a placeholder, and each block below the composer
 * degrades on its own — a failure in any of them should not cost the seller
 * the composer above.
 */
export default async function HomePage() {
  const session = await requireOnboardedSession();
  const firstName = session.name?.split(" ")[0];

  // The server's clock, not the browser's. Every window below is derived
  // from this one value so the month the figures cover, the month the chart
  // is labelled with and the "Today" in the activity feed are the same month.
  const today = new Date();
  const windows = monthWindows(today);

  const [{ tiles }, currentImport, { dashboard }, monthOrders, listings, connectors] =
    await Promise.all([
      loadHomeTiles(session.backendToken),
      loadCurrentImport(session.workspaceId, session.backendToken),
      loadHomeDashboard(session.backendToken),
      listOrders(
        {
          limit: EXPORT_LIMIT,
          orderBy: "order_date",
          order: "asc",
          fromDate: overviewFrom(windows),
        },
        session.backendToken,
      ),
      // One row, for the count alone: `total` is every listing matching the
      // filters, and there are none, so it is the whole catalogue.
      loadListings({ limit: 1 }, session.backendToken),
      listConnectors(session.workspaceId, session.backendToken).catch(
        () => [] as ConnectorStatus[],
      ),
    ]);

  const greeting = tiles
    ? openingMessage(tiles, firstName)
    : [
        firstName ? `Hi ${firstName}.` : "Hi.",
        "I can't reach your numbers this second. The tabs on the left still work.",
      ];

  const overview = summariseOrders(monthOrders.page.rows, windows);

  const belowHero = (
    <HomeOverview
      overview={overview}
      alerts={dashboard?.alerts ?? []}
      connectors={connectors}
      // Null, not zero, when the read failed — the tile says it could not be
      // read rather than claiming the seller has no products.
      listings={listings.error ? null : listings.page.total}
      currentImport={currentImport}
      // The dashboard read is what knows which currency carries the month;
      // the order rows carry their own and may be mixed.
      currency={dashboard?.currency ?? monthOrders.page.totals.currency ?? null}
      thisLabel={MONTHS[today.getMonth()]}
      lastLabel={MONTHS[(today.getMonth() + 11) % 12]}
      today={today}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <ChatWorkspace
          greeting={greeting}
          suggestions={suggestionsFor("/home")}
          importing={isImporting(currentImport)}
          belowHero={belowHero}
        />
      </div>
    </div>
  );
}
