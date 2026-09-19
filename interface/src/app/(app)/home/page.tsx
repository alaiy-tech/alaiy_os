import Link from "next/link";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { loadHomeTiles } from "@/lib/backend/dashboard";
import { loadHomeDashboard } from "@/lib/backend/home";
import { EXPORT_LIMIT, listOrders } from "@/lib/backend/orders";
import { windowStart } from "@/lib/listing";
import { openingMessage } from "@/lib/ask/greeting";
import { suggestionsFor } from "@/lib/ask/suggestions";
import { ChatWorkspace } from "@/components/ask/chat-workspace";
import { listChatSessions } from "@/lib/backend/chat";
import { isImporting, loadCurrentImport } from "@/lib/backend/imports";
import { KpiTiles } from "@/app/(app)/dashboard/kpi-tiles";
import { AlertBar } from "@/app/(app)/dashboard/alert-bar";
import { SalesTrendChart } from "@/app/(app)/home/sales-trend-chart";
import type { ChatSessionSummary } from "@/lib/backend/types";

/** How many days of real order history the trend chart buckets by day. */
const TREND_WINDOW_DAYS = 30;

export const metadata = { title: "Ask Alaiy" };

/**
 * Home is Ask Alaiy: the conversation, and the seller's past chats beside it.
 *
 * Which chat is open comes from `?chat=`, so a conversation has a URL — it
 * survives a reload, and can be reopened from the rail tomorrow. With no
 * parameter it opens the most recent one, which is also what the docked panel
 * on the data tabs does: that is how a question asked on Orders is still there
 * when the seller comes back to Home, without either surface having to tell
 * the other anything.
 *
 * No session is created here. One appears when a question is asked, or every
 * visit to this page would leave an empty chat in the rail.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string }>;
}) {
  const session = await requireOnboardedSession();
  const { chat } = await searchParams;
  const firstName = session.name?.split(" ")[0];

  // None of these are fatal. The greeting has a fallback, the rail can be
  // empty, the import check only decides a placeholder, and the dashboard
  // block below the composer degrades on its own (see below) — a failure in
  // any of them should not cost the seller the composer.
  const [{ tiles }, currentImport, sessions, { dashboard }, trendOrders] = await Promise.all([
    loadHomeTiles(session.backendToken),
    loadCurrentImport(session.workspaceId, session.backendToken),
    listChatSessions(session.backendToken).catch(() => [] as ChatSessionSummary[]),
    loadHomeDashboard(session.backendToken),
    listOrders(
      {
        limit: EXPORT_LIMIT,
        orderBy: "order_date",
        order: "asc",
        fromDate: windowStart(String(TREND_WINDOW_DAYS)),
      },
      session.backendToken,
    ),
  ]);

  const greeting = tiles
    ? openingMessage(tiles, firstName)
    : [
        firstName ? `Hi ${firstName}.` : "Hi.",
        "I can't reach your numbers this second. The tabs on the left still work.",
      ];

  // A `chat` that is not theirs is not honoured: the poll would 403 on it and
  // the screen would sit empty. Falling back to their newest is both safe and
  // what someone following a stale link wants.
  const known = sessions.some((row) => row.name === chat);
  const active = (known ? chat : sessions[0]?.name) ?? null;

  // The glance, under the question — same tiles and alerts Dashboard shows,
  // plus a real trend built from this window's own order dates. Nothing here
  // is fatal on its own: a missing dashboard just leaves the section out
  // rather than costing the seller the composer above it.
  const belowHero = dashboard ? (
    <div className="space-y-5">
      <KpiTiles dashboard={dashboard} />
      {dashboard.alerts.length ? <AlertBar alerts={dashboard.alerts} /> : null}
      {trendOrders.page.rows.length ? (
        <SalesTrendChart
          orders={trendOrders.page.rows}
          days={TREND_WINDOW_DAYS}
          currency={dashboard.currency}
        />
      ) : null}
    </div>
  ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <ChatWorkspace
          key={active ?? "new"}
          sessions={sessions}
          initialActive={active}
          greeting={greeting}
          suggestions={suggestionsFor("/home")}
          importing={isImporting(currentImport)}
          belowHero={belowHero}
        />
      </div>
    </div>
  );
}
