import Link from "next/link";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { loadHomeDashboard } from "@/lib/backend/home";
import { listOrders } from "@/lib/backend/orders";
import { listConnectors } from "@/lib/backend/connectors";
import { DEFAULT_WINDOW, windowStart } from "@/lib/listing";
import { isImporting, loadCurrentImport } from "@/lib/backend/imports";
import { ImportingBanner } from "@/components/data/importing-banner";
import { Alert, Eyebrow } from "@/components/ui";
import { AlertBar } from "@/app/(app)/dashboard/alert-bar";
import { KpiTiles } from "@/app/(app)/dashboard/kpi-tiles";
import { RecentOrders } from "@/app/(app)/dashboard/recent-orders";
import { SyncStrip } from "@/app/(app)/dashboard/sync-strip";
import type { ConnectorStatus } from "@/lib/backend/types";

export const metadata = { title: "Dashboard — Alaiy" };

/** The spec's snippet length: enough to spot something obvious, not a table. */
const RECENT_ORDERS = 10;

/**
 * The Dashboard: sixty seconds of orientation, and then out.
 *
 * This is the tab that replaces the ritual — Seller Central, the Shopify
 * admin, a spreadsheet, email and a tracker, all opened before anything useful
 * has happened. Four figures, up to three things Alaiy noticed, the last ten
 * orders, and when each channel was last pulled. Nothing here is a place to
 * work: every alert and every order row leads to the tab where the thing can
 * actually be done.
 *
 * It is its own route rather than a band under Ask Alaiy. Scanning four
 * figures and reading a transcript are different postures, and stacking them
 * meant the tiles lived below the fold on the one screen whose whole purpose
 * is to be read at a glance. Home stays the conversation; this is the glance.
 * The docked Ask panel comes along on the right, as it does on every data tab,
 * so a question about a number is still one click from the number.
 *
 * ## Nothing here is allowed to be fatal
 *
 * Four reads, and a failure in any of them costs the seller that one piece.
 * `loadHomeDashboard` and `listOrders` return their errors rather than
 * throwing, and the connector list is caught. A seller whose backend is having
 * a bad morning still gets the shell, the rail and the other tabs.
 */
export default async function DashboardPage() {
  const session = await requireOnboardedSession();

  const [{ dashboard, error }, orders, connectors, currentImport] = await Promise.all([
    loadHomeDashboard(session.backendToken),
    // Newest first, and the one view in the product that is not "problems
    // first" — see RecentOrders. The flags still come back on every row.
    //
    // Bounded to the same window the Orders tab opens on, for two reasons:
    // clicking through lands on a view that contains these rows, and
    // `list_orders` computes its totals strip over whatever it is given —
    // figures this snippet never shows. Unbounded, this would run two full
    // aggregates over every order the seller has ever had, every morning.
    listOrders(
      {
        limit: RECENT_ORDERS,
        orderBy: "order_date",
        order: "desc",
        fromDate: windowStart(DEFAULT_WINDOW),
      },
      session.backendToken,
    ),
    listConnectors(session.workspaceId, session.backendToken).catch(
      () => [] as ConnectorStatus[],
    ),
    // Cached, so this is the call the layout already made for the status box.
    loadCurrentImport(session.workspaceId, session.backendToken),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your morning</Eyebrow>
        <h1 className="text-display-md">Where the business stands</h1>
        <p className="text-[13px] text-muted">
          Today against the same point last week, and anything Alaiy noticed
          since you were last here.
        </p>
      </div>

      {/* The floating import toast is mounted in the layout and follows the
          seller everywhere. This says the same thing where it changes how a
          number should be read: mid-import the tiles are counting a window
          that is still filling in, and a GMV figure nobody warned you was
          partial is worse than no figure. Orders and Inventory carry the same
          banner for the same reason. */}
      {isImporting(currentImport) ? <ImportingBanner job={currentImport} /> : null}

      {/* The tiles are the reason for the tab, so their failure is stated
          rather than left as four em dashes with no explanation. */}
      {error ? <Alert>{error}</Alert> : null}

      {dashboard ? (
        <>
          <KpiTiles dashboard={dashboard} />
          <AlertBar alerts={dashboard.alerts} />
        </>
      ) : null}

      <div className="space-y-2 pt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-display-sm">Latest orders</h2>
          <Link
            href="/orders"
            className="text-[12px] text-muted underline-offset-2 hover:text-primary-600 hover:underline"
          >
            All orders, problems first →
          </Link>
        </div>

        {orders.error ? (
          <Alert>{orders.error}</Alert>
        ) : (
          <RecentOrders page={orders.page} />
        )}
      </div>

      <SyncStrip connectors={connectors} asOf={dashboard?.as_of} />
    </div>
  );
}
