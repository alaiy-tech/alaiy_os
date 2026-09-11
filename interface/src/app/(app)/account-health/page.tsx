import Link from "next/link";
import { requireOnboardedSession } from "@/lib/auth/dal";
import {
  TREND_DAYS,
  loadAccountHealth,
  loadContributingOrders,
  loadHealthTrend,
} from "@/lib/backend/account-health";
import { firstValue, hrefToString } from "@/lib/listing";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { Alert, ButtonLink, Eyebrow, Pill } from "@/components/ui";
import { SellerCentralLink } from "@/components/channel/seller-central-link";
import { bannerFor } from "@/lib/health/status";
import { Contributing } from "@/app/(app)/account-health/contributing";
import { MetricTiles } from "@/app/(app)/account-health/metric-tiles";
import { TrendChart } from "@/app/(app)/account-health/trend-chart";
import type { HealthGap, LateShipmentOutlook } from "@/lib/backend/types";

export const metadata = { title: "Account Health — Alaiy" };

const PATH = "/account-health";

/**
 * Account Health: how close this Amazon account is to being suspended.
 *
 * Amazon can deactivate a seller without warning when a performance metric
 * crosses a published threshold. Seller Central shows the number. It does not
 * say how much room is left, which orders are spending it, or where the Late
 * Shipment Rate lands if the two orders sitting unshipped go out late. That
 * arithmetic is the whole tab.
 *
 * **Amazon only, and labelled as such in the header.** Shopify has no account
 * suspension mechanism, so there is no Shopify equivalent to show — that is a
 * design decision the spec makes explicitly, not a gap, and the header says so
 * rather than leaving a seller to wonder where their other channel went.
 *
 * Which metric is expanded lives in `?metric=`, so a tile opened on the orders
 * behind a bad rate is a link someone can send to whoever is dealing with it —
 * the same reason every filter on Orders is in the URL.
 *
 * Two parts of the spec have no data behind them and say so where a seller
 * would look for them: policy warnings need an API the integration does not
 * have yet, and A-to-Z claims arrive as counts rather than per order. Showing
 * that beats a screen that looks complete and quietly is not.
 */
export default async function AccountHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string }>;
}) {
  const session = await requireOnboardedSession();
  const params = await searchParams;
  const requested = firstValue(params.metric);

  const [{ health, error }, trend] = await Promise.all([
    loadAccountHealth(session.backendToken),
    loadHealthTrend(session.backendToken),
  ]);

  // Only a metric that exists and can actually name its orders is honoured. A
  // stale link to one that cannot would otherwise render a panel saying so,
  // under a tile that never offered to open.
  const expandedMetric = health?.metrics.find(
    (metric) => metric.metric_key === requested,
  );
  const contributing = expandedMetric
    ? await loadContributingOrders(expandedMetric.metric_key, session.backendToken)
    : null;

  const hrefFor = (metricKey: string | undefined) =>
    hrefToString({ pathname: PATH, query: metricKey ? { metric: metricKey } : {} });

  const banner = bannerFor(health?.status ?? "unknown");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your data</Eyebrow>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-display-md">Account Health</h1>
          {/* Not an error state. Amazon is the only channel with a suspension
              mechanism, so this tab has one channel by design. */}
          <Pill tone="warn">Amazon only</Pill>
          {/* Amazon's own dashboard. A companion rather than a redirect: this
              tab exists to say how much room a metric has left, which that
              page does not. */}
          <SellerCentralLink
            href={health?.seller_central}
            label="Open Account Health in Seller Central"
            size="md"
            className="ml-auto"
          >
            Seller Central
          </SellerCentralLink>
        </div>
        <p className="text-[13px] text-muted">
          How much room is left before Amazon&rsquo;s thresholds, and which
          orders are spending it. Shopify has no equivalent — there is no
          account to suspend.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {health && !health.connected ? (
        <NotConnected />
      ) : health ? (
        <>
          {/* The banner is the answer to "is anything on fire", so it is the
              first thing on the screen and it reads proximity, not just
              breach: "At risk" exists to be seen before anything crosses. */}
          <section
            aria-label="Account status"
            className={`flex overflow-hidden rounded-sm border ${banner.card}`}
          >
            <span aria-hidden className={`w-[3px] shrink-0 ${banner.rule}`} />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3.5 py-3">
              <h2 className={`text-display-xs ${banner.ink}`}>{banner.label}</h2>
              <p className={`text-[13px] ${banner.ink}`}>
                {health.never_synced
                  ? "Amazon hasn't been asked for this account's metrics yet. The first pull runs on the next daily sync."
                  : banner.blurb}
              </p>
            </div>
          </section>

          {health.metrics.length ? (
            <MetricTiles
              metrics={health.metrics}
              hrefFor={hrefFor}
              expanded={expandedMetric?.metric_key}
            />
          ) : null}

          {/* Directly under the tiles, because it is the one tile with a
              consequence attached rather than just a number. */}
          {health.late_shipment ? (
            <LateShipment outlook={health.late_shipment} />
          ) : null}

          {expandedMetric ? (
            <Contributing metric={expandedMetric} data={contributing} />
          ) : null}

          <div className="space-y-2 pt-2">
            <h2 className="text-display-sm">Last {TREND_DAYS} days</h2>
            {trend ? (
              <TrendChart trend={trend} metrics={health.metrics} />
            ) : (
              <p className="text-[13px] text-muted">
                The trend isn&rsquo;t available just now. The figures above are
                unaffected.
              </p>
            )}
          </div>

          <Gaps gaps={health.gaps} />

          <p className="text-[12px] text-muted">
            {health.synced_at
              ? `Read from Amazon's performance report at ${formatDateTime(health.synced_at)}. Amazon rebuilds it about once a day.`
              : "Nothing read from Amazon yet."}
          </p>
        </>
      ) : null}
    </div>
  );
}

/**
 * Where Late Shipment Rate goes if the unshipped orders go out late.
 *
 * The spec asks for this in V1, and it is the one projection the data
 * supports. It is stated as an estimate and shows its working, because the
 * denominator is ours and not Amazon's: Amazon reports the rate but neither
 * the window it used nor how many shipments were in it. A seller who acts on
 * "4.2%" as though Amazon had said it, and is wrong, has been misled — so the
 * number is given with the count it was computed over, in the same breath.
 */
function LateShipment({ outlook }: { outlook: LateShipmentOutlook }) {
  const tone = outlook.breaches
    ? { card: "border-alert/30 bg-alert-soft", ink: "text-alert-ink" }
    : { card: "border-warn/40 bg-warn-soft", ink: "text-warn-ink" };

  return (
    <section
      aria-label="Late shipment outlook"
      className={`space-y-1.5 rounded-sm border px-3.5 py-3 ${tone.card}`}
    >
      <h2 className={`text-display-xs ${tone.ink}`}>
        {outlook.at_risk_count === 1
          ? "1 order is at or past the date you promised Amazon"
          : `${formatNumber(outlook.at_risk_count)} orders are at or past the date you promised Amazon`}
      </h2>

      <p className={`text-[13px] ${tone.ink}`}>
        Late Shipment Rate is {formatPercent(outlook.current)} against a limit
        of {formatPercent(outlook.target)}.{" "}
        {outlook.projected === null ? (
          <>
            There isn&rsquo;t enough shipped volume behind it to project where
            these would take it.
          </>
        ) : (
          <>
            If all of them ship late it lands near{" "}
            <span className="font-data font-semibold tabular-nums">
              {formatPercent(outlook.projected)}
            </span>
            {outlook.breaches ? " — over the limit." : ", still inside the limit."}
          </>
        )}
      </p>

      {/* The working, not a footnote. This is the one number on the tab that
          Amazon did not give us. */}
      {outlook.projected !== null ? (
        <p className={`text-[12px] ${tone.ink}`}>
          An estimate: Amazon publishes the rate but not the window or the
          shipment count behind it, so this is measured against the{" "}
          {formatNumber(outlook.denominator)} Amazon orders you took in the
          last {outlook.window_days} days.
        </p>
      ) : null}

      <p className="pt-0.5">
        <Link
          href={hrefToString({
            pathname: PATH,
            query: { metric: "lateShipmentRate" },
          })}
          className={`text-[12px] font-medium underline-offset-2 hover:underline ${tone.ink}`}
        >
          See which orders →
        </Link>
      </p>
    </section>
  );
}

/**
 * What this tab cannot tell you, where you would look for it.
 *
 * The alternative is a screen that looks complete: a seller comparing it
 * against Seller Central finds a policy warning that is not here and concludes
 * the tab is broken or, worse, that they have no warnings. Each gap names what
 * would have to be built.
 */
function Gaps({ gaps }: { gaps: HealthGap[] }) {
  if (!gaps.length) return null;

  return (
    <section aria-label="Not covered here" className="space-y-2 pt-2">
      <h2 className="text-display-sm">Not covered here</h2>
      <ul className="space-y-2">
        {gaps.map((gap) => (
          <li
            key={gap.key}
            className="rounded-sm border border-line bg-surface px-3.5 py-2.5"
          >
            <p className="text-[13px] font-medium text-ink">{gap.title}</p>
            <p className="pt-0.5 text-[12.5px] leading-snug text-muted">{gap.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotConnected() {
  return (
    <div className="space-y-3 rounded-sm border border-line bg-white px-4 py-8 text-center">
      <p className="text-[13px] text-muted">
        This tab reads Amazon&rsquo;s Seller Performance report, so it needs an
        Amazon account attached. Shopify has no equivalent metrics — there is no
        account for Shopify to suspend.
      </p>
      <div className="flex justify-center">
        <ButtonLink href="/channels" size="sm">
          Connect Amazon
        </ButtonLink>
      </div>
    </div>
  );
}
