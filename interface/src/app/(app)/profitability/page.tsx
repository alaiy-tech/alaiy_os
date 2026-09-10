import Link from "next/link";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { Alert, ButtonLink, Eyebrow, Pill } from "@/components/ui";
import { WINDOW_OPTIONS, loadProfitability } from "@/lib/backend/profitability";
import { firstValue, hrefToString } from "@/lib/listing";
import { formatDateTime } from "@/lib/format";
import type { PnlCoverage } from "@/lib/profitability/types";
import { BuyBoxPanel } from "./buy-box-panel";
import { PnlTable } from "./pnl-table";

export const metadata = { title: "Profitability — Alaiy" };

const PATH = "/profitability";

/**
 * The Profitability tab: margin per SKU, not just revenue.
 *
 * Both channels are here, and they answer with different halves of the same
 * question. Revenue and units come from the orders both channels sync. The
 * cost of selling does not: Amazon's fees settle two to four weeks after the
 * sale and are quoted in the meantime, while Shopify's processing fee arrives
 * on the order itself and is an actual from day one. That asymmetry is why
 * every fee figure on this page carries where it came from.
 *
 * Three columns are visibly empty and say why. Shipping cost needs a WMS, COGS
 * needs lot-level cost per PO line, and net margin is the figure that needs
 * COGS. They stay on screen rather than disappearing, so the gross margin is
 * never mistaken for the whole answer.
 *
 * The period lives in `?days=`, so a view someone has narrowed is a link they
 * can send — the same reason every filter on Orders is in the URL.
 */
export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await requireOnboardedSession();
  const params = await searchParams;

  const requested = firstValue(params.days);
  const days = WINDOW_OPTIONS.some((option) => option.value === requested)
    ? Number(requested)
    : undefined;

  const { page, error } = await loadProfitability(days, session.backendToken);
  const { coverage } = page;
  // The backend picks this off the rows themselves; ₹ is only the fallback for
  // a workspace with nothing sold yet, where no money is rendered anyway.
  const currency = page.currency ?? "INR";

  const connected = coverage.amazon_connected || coverage.shopify_connected;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your data</Eyebrow>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-display-md">Profitability</h1>
          {coverage.amazon_connected ? <Pill tone="neutral">Amazon</Pill> : null}
          {coverage.shopify_connected ? <Pill tone="neutral">Shopify</Pill> : null}
        </div>
        <p className="max-w-2xl text-[13px] text-muted">
          Fees and revenue per SKU — so your top seller and your best margin can turn out
          to be two different products.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {!connected ? (
        <NotConnected />
      ) : (
        <>
          <PeriodTabs days={page.days} />

          <Coverage coverage={coverage} />

          <PnlTable rows={page.rows} currency={currency} />

          <BuyBoxPanel rows={page.rows} currency={currency} />

          <p className="text-[12px] text-muted">
            {coverage.synced_at
              ? `Fees and Buy Box read from Amazon at ${formatDateTime(coverage.synced_at)}. Revenue is as fresh as your last order sync.`
              : "Revenue and units are from your synced orders. Amazon fees haven't been pulled yet — the first pull runs on the next daily sync."}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * The reporting window, as links rather than a select.
 *
 * A select would need a client component and an onChange that pushes a route,
 * for a control with three options that are all just URLs.
 */
function PeriodTabs({ days }: { days: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {WINDOW_OPTIONS.map((option) => {
        const active = Number(option.value) === days;
        return (
          <Link
            key={option.value}
            href={hrefToString({ pathname: PATH, query: { days: option.value } })}
            aria-current={active ? "page" : undefined}
            className={`rounded-xs border px-2.5 py-1 text-[12px] font-medium transition-colors ${
              active
                ? "border-primary-600/40 bg-primary-600/[0.08] text-primary-600"
                : "border-line bg-surface text-muted hover:text-primary-600"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * What these numbers are made of, before anyone reads a margin off them.
 *
 * Each notice is a different missing thing with a different consequence, and
 * none of them is inferable from an empty column: a blank Buy Box column means
 * "no Amazon account", "the Selling Partner Insights role was never granted",
 * or "the first report hasn't come back yet", and a seller can act on only one
 * of those.
 */
function Coverage({ coverage }: { coverage: PnlCoverage }) {
  const notices: { key: string; tone: "info" | "warn"; body: React.ReactNode }[] = [];

  notices.push({
    key: "cogs",
    tone: "info",
    body: (
      <>
        COGS and per-SKU shipping cost aren&rsquo;t connected — those columns stay
        visible and say so rather than disappearing, because a real build needs
        lot-level cost per PO line and a connected WMS, not one averaged number. Gross
        margin below is everything fees alone can tell you; net margin is the figure
        that needs COGS, so it reads &ldquo;coming soon&rdquo; too rather than silently
        repeating gross.
      </>
    ),
  });

  if (coverage.amazon_connected && !coverage.has_fee_data) {
    notices.push({
      key: "no-fees",
      tone: "warn",
      body: (
        <>
          No Amazon fee data yet. Fee quotes need the Product Listing role and settled
          fees need Finance and Accounting — if you granted neither when you connected,
          reauthorise from{" "}
          <Link href="/channels" className="font-medium underline underline-offset-2">
            Channels
          </Link>
          . Until then the Amazon rows below show revenue without a margin, rather than a
          margin computed from a fee we don&rsquo;t have.
        </>
      ),
    });
  } else if (coverage.amazon_connected && !coverage.has_settled_fees) {
    notices.push({
      key: "unsettled",
      tone: "info",
      body: (
        <>
          Every Amazon fee here is Amazon&rsquo;s own quote rather than what it has
          taken — nothing in this period has settled yet. Amazon settles two to four
          weeks after a sale, so the figures firm up as that catches up, and each one is
          marked <span className="font-semibold uppercase">est.</span> until it does.
        </>
      ),
    });
  }

  if (coverage.amazon_connected && !coverage.has_buy_box) {
    notices.push({
      key: "no-buy-box",
      tone: "info",
      body: (
        <>
          No Buy Box data. It comes from Amazon&rsquo;s Sales &amp; Traffic report, which
          needs the Selling Partner Insights role — the same one Account Health uses. A
          brand-new seller can also simply have no sessions in the window yet.
        </>
      ),
    });
  }

  if (coverage.shopify_connected && coverage.shopify_skus > 0 && !coverage.shopify_fees_available) {
    notices.push({
      key: "shopify-fees",
      tone: "info",
      body: (
        <>
          Shopify hasn&rsquo;t reported a processing fee on these orders. It only does so
          for stores paid through Shopify Payments — on any other gateway the fee is
          charged by that provider and Shopify never sees it, so the column reads
          &ldquo;unknown&rdquo; rather than zero.
        </>
      ),
    });
  }

  return (
    <div className="space-y-2">
      {notices.map((notice) => (
        <Alert key={notice.key} tone={notice.tone}>
          {notice.body}
        </Alert>
      ))}
    </div>
  );
}

function NotConnected() {
  return (
    <div className="space-y-3 rounded-sm border border-line bg-white px-4 py-8 text-center">
      <p className="text-[13px] text-muted">
        This tab works out margin from the orders and fees your channels report, so it
        needs at least one connected. Amazon brings referral and FBA fees plus your Buy
        Box standing; Shopify brings revenue and, on Shopify Payments, the processing
        fee.
      </p>
      <div className="flex justify-center">
        <ButtonLink href="/channels" size="sm">
          Connect a channel
        </ButtonLink>
      </div>
    </div>
  );
}
