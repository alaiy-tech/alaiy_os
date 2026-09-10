import Link from "next/link";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { Alert, ButtonLink, Eyebrow, Pill } from "@/components/ui";
import { EmptyRow, TableFrame, Td, Th } from "@/components/data/table";
import { formatDateTime, formatNumber } from "@/lib/format";
import { firstValue, hrefToString } from "@/lib/listing";
import { WINDOW_OPTIONS, loadShipping } from "@/lib/backend/shipping";
import {
  coverageNote,
  exceptionCount,
  hasReliableRates,
  trendFor,
  underperforming,
  type Trend,
} from "@/lib/shipping/presentation";
import type {
  CarrierRow,
  ShippingCoverage,
  ShippingMetric,
  ShippingSummary,
} from "@/lib/shipping/types";
import { HandlingTimeChart } from "./handling-time-chart";
import { LateShipmentRow } from "./late-shipment-row";

export const metadata = { title: "Shipping — Alaiy" };

const PATH = "/shipping";
const LATE_COLUMNS = 6;

/**
 * The Shipping tab: aggregate fulfilment health, not an order-by-order audit.
 *
 * Both channels are here, from three sources that answer different questions.
 * Amazon's merchant-fulfilled parcels come from the Orders API, its own from
 * the fulfilled-shipments report, and Shopify's from the order's fulfilments —
 * and they do not fill in the same columns. That asymmetry is why almost every
 * figure on this page shows what it was computed over: on-time delivery in
 * particular can only speak for parcels that report a delivery date, and
 * Amazon's own never do.
 *
 * Late Shipment Rate is read from Account Health rather than derived here. It
 * is the number Amazon judges the account on, and a tab that computed its own
 * would eventually disagree with Seller Central about the same figure.
 *
 * The period lives in `?days=`, so a narrowed view is a link someone can send.
 */
export default async function ShippingPage({
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

  const { page, error } = await loadShipping(days, session.backendToken);
  const { summary, coverage, late_shipments: late } = page;

  const connected = coverage.amazon_connected || coverage.shopify_connected;
  const lsr = summary.late_shipment_rate_pct;
  const lsrAtRisk = lsr.value !== null && lsr.value >= summary.threshold;
  const slow = underperforming(page.carriers);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your data</Eyebrow>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-display-md">Shipping</h1>
          {coverage.amazon_connected ? <Pill tone="neutral">Amazon</Pill> : null}
          {coverage.shopify_connected ? <Pill tone="neutral">Shopify</Pill> : null}
        </div>
        <p className="max-w-2xl text-[13px] text-muted">
          Fulfilment health in aggregate — handling time, carrier performance and on-time rate —
          so a decline shows up before it becomes an Account Health warning.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {!connected ? (
        <NotConnected />
      ) : (
        <>
          <PeriodTabs days={page.days} />

          {lsr.value !== null ? (
            <Alert tone={lsrAtRisk ? "warn" : "info"}>
              Your Late Shipment Rate feeds Amazon&rsquo;s Account Health — currently{" "}
              <span className="font-semibold">{lsr.value.toFixed(1)}%</span>, against
              Amazon&rsquo;s {summary.threshold.toFixed(0)}% threshold. This is Amazon&rsquo;s own
              reading{lsr.as_of ? `, from ${lsr.as_of}` : null}, read from the same pipeline{" "}
              <Link href="/account-health" className="font-medium underline underline-offset-2">
                Account Health
              </Link>{" "}
              uses — not a second calculation that could disagree with it.
            </Alert>
          ) : (
            <Alert tone="info">
              No Late Shipment Rate yet. It comes from Amazon&rsquo;s performance report on the
              daily Account Health pull, and needs an Amazon account connected — it is not
              computed from the shipments below, so that the figure here and the one Amazon
              judges you on can never disagree.
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile
              label="Avg. handling time"
              metric={summary.avg_handling_hours}
              format={(value) => `${value}h`}
              trend={trendFor(summary.avg_handling_hours, {
                higherIsBetter: false,
                unit: "h",
                digits: 0,
              })}
              note="Order placed to dispatch. Seller-shipped only — Amazon handles FBA, so there's no handling time of yours in it."
            />
            <MetricTile
              label="On-time dispatch"
              metric={summary.on_time_dispatch_pct}
              format={(value) => `${value}%`}
              trend={trendFor(summary.on_time_dispatch_pct, { higherIsBetter: true, unit: "pp", digits: 0 })}
              note="Against the date Amazon was promised. Shopify makes no dispatch promise we can read, so its orders aren't counted either way."
            />
            <MetricTile
              label="On-time delivery"
              metric={summary.on_time_delivery_pct}
              format={(value) => `${value}%`}
              trend={trendFor(summary.on_time_delivery_pct, { higherIsBetter: true, unit: "pp", digits: 0 })}
              note="Amazon's fulfilled-shipments report gives an estimated arrival date and no actual one, so FBA parcels sit outside this figure however well they were delivered."
            />
            <MetricTile
              label="Late Shipment Rate"
              metric={lsr}
              format={(value) => `${value.toFixed(1)}%`}
              trend={trendFor(lsr, { higherIsBetter: false, unit: "pp" })}
              note="Amazon's own figure, not ours."
            />
          </div>

          <Coverage coverage={coverage} />

          <section className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
                Handling time — last {page.days} days
              </h2>
              <p className="text-[11.5px] text-muted-soft">
                Order placed to dispatch confirmed. FBA orders are excluded — Amazon handles
                those, so there is no handling time of yours to measure.
              </p>
            </div>
            <div className="rounded-sm border border-line bg-white px-4 py-4">
              {page.handling_time_trend.length ? (
                <HandlingTimeChart points={page.handling_time_trend} />
              ) : (
                <p className="py-6 text-center text-[13px] text-muted">
                  Nothing dispatched by you in this period, so there is no handling time to plot.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
              Carrier breakdown
            </h2>
            <TableFrame minWidth="48rem">
              <thead>
                <tr>
                  <Th>Carrier</Th>
                  <Th align="right">Shipments</Th>
                  <Th align="right">On-time %</Th>
                  <Th align="right">Avg. transit days</Th>
                  <Th align="right">Exceptions</Th>
                </tr>
              </thead>
              <tbody>
                {page.carriers.length === 0 ? (
                  <EmptyRow colSpan={5}>No shipments in this period.</EmptyRow>
                ) : (
                  page.carriers.map((carrier) => (
                    <CarrierRowView key={carrier.carrier} carrier={carrier} />
                  ))
                )}
              </tbody>
            </TableFrame>
            <p className="text-[11.5px] leading-snug text-muted-soft">
              Exceptions are the carrier&rsquo;s own classification — lost, returned, or an
              exception such as undeliverable or damaged. There is no &ldquo;stuck&rdquo; count:
              that would be our guess about a parcel still moving, sitting in a column of things
              carriers actually reported.
            </p>
            {slow.length ? (
              <p className="text-[12px] text-alert-ink">
                {slow.map((c) => c.carrier).join(", ")}{" "}
                {slow.length === 1 ? "is" : "are"} below 85% on-time this period. Alaiy has no
                delivery addresses on these parcels, so it can&rsquo;t tell you whether that is
                regional — the carrier can.
              </p>
            ) : null}
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
                Late shipments
              </h2>
              {late.at_risk.length ? (
                <p className="text-[12px] text-alert-ink">
                  {late.at_risk.length} order{late.at_risk.length === 1 ? "" : "s"} not yet
                  dispatched — ship these today to keep the Late Shipment Rate from crossing{" "}
                  {summary.threshold.toFixed(0)}%.
                </p>
              ) : null}
            </div>
            <TableFrame minWidth="44rem">
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th>Channel</Th>
                  <Th>Order</Th>
                  <Th>Carrier</Th>
                  <Th>Promised ship by</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {late.at_risk.length === 0 && late.shipped_late.length === 0 ? (
                  <EmptyRow colSpan={LATE_COLUMNS}>Nothing late or at risk right now.</EmptyRow>
                ) : (
                  <>
                    {late.at_risk.map((shipment) => (
                      <LateShipmentRow
                        key={`risk:${shipment.external_order_id}`}
                        shipment={shipment}
                        status="at_risk"
                      />
                    ))}
                    {late.shipped_late.map((shipment) => (
                      <LateShipmentRow
                        key={`late:${shipment.external_order_id}`}
                        shipment={shipment}
                        status="shipped_late"
                      />
                    ))}
                  </>
                )}
              </tbody>
            </TableFrame>
            <p className="text-[11.5px] leading-snug text-muted-soft">
              Amazon, seller-shipped only. FBA is excluded because Amazon ships those itself and
              they cannot count against you; Shopify because it makes no dispatch promise to be
              late against, and inventing one from a threshold of ours would put orders here that
              nobody agreed were late.
            </p>
          </section>

          <p className="text-[12px] text-muted">
            {coverage.synced_at
              ? `Parcels read at ${formatDateTime(coverage.synced_at)}. Amazon's are pulled daily; Shopify's arrive with your hourly order sync.`
              : "No parcels pulled yet. Amazon's first pull runs on the next daily sync; Shopify's arrive with your orders."}
          </p>
        </>
      )}
    </div>
  );
}

/** The reporting window, as links rather than a select — three options that
 *  are all just URLs need no client component. */
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
 * One tile, with the coverage of its own number under it.
 *
 * A tile whose metric could not be computed shows an em dash and says why,
 * rather than a zero. Zero handling time and "nothing shipped" are opposite
 * readings of the same blank.
 */
function MetricTile({
  label,
  metric,
  format,
  trend,
  note,
}: {
  label: string;
  metric: ShippingMetric;
  format: (value: number) => string;
  trend: Trend;
  note: string;
}) {
  const coverage = coverageNote(metric);
  const arrow = trend?.direction === "up" ? "↑" : trend?.direction === "down" ? "↓" : "→";
  const toneClass =
    trend?.tone === "ok" ? "text-ok-ink" : trend?.tone === "alert" ? "text-alert-ink" : "text-muted";

  return (
    <div className="rounded-sm border border-line bg-white px-4 py-3.5" title={note}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        {label}
      </p>
      <p className="pt-1 font-data text-display-sm text-primary-600">
        {metric.value === null ? <span className="text-muted-soft">—</span> : format(metric.value)}
      </p>
      {trend ? (
        <p className={`font-data text-[12px] font-medium ${toneClass}`}>
          <span aria-hidden>{arrow}</span> {trend.label}
          <span className="pl-1 font-sans text-muted-soft">vs previous period</span>
        </p>
      ) : (
        <p className="font-sans text-[12px] text-muted-soft">
          {metric.value === null ? "not enough data" : "no earlier period to compare"}
        </p>
      )}
      {coverage ? <p className="pt-0.5 text-[11px] text-muted-soft">{coverage}</p> : null}
    </div>
  );
}

function CarrierRowView({ carrier }: { carrier: CarrierRow }) {
  const reliable = hasReliableRates(carrier);
  const exceptions = exceptionCount(carrier.exceptions);

  return (
    <tr className="border-b border-line/60 last:border-0">
      <Td className="font-medium">
        {carrier.carrier}
        {carrier.fba ? (
          <span className="ml-1.5 text-[11px] font-normal text-muted-soft">
            (Amazon&rsquo;s network)
          </span>
        ) : null}
        {carrier.thin ? (
          <span
            className="ml-1.5 text-[11px] font-normal text-muted-soft"
            title="Too few shipments for these percentages to describe the carrier rather than the sample."
          >
            thin sample
          </span>
        ) : null}
      </Td>
      <Td align="right">{formatNumber(carrier.shipments)}</Td>
      <Td align="right">
        {carrier.on_time_pct === null ? (
          <span
            className="text-muted-soft"
            title="No parcel on this carrier reports both an estimated and an actual delivery date, so there is no on-time rate — which is not the same as a bad one."
          >
            —
          </span>
        ) : (
          <span
            className={
              reliable && carrier.on_time_pct < 85 ? "font-semibold text-alert-ink" : reliable ? "" : "text-muted-soft"
            }
            title={`Over ${carrier.deliveries_measured} delivered parcel${carrier.deliveries_measured === 1 ? "" : "s"}.`}
          >
            {carrier.on_time_pct}%
          </span>
        )}
      </Td>
      <Td align="right">
        {carrier.avg_transit_days === null ? (
          <span className="text-muted-soft">—</span>
        ) : (
          carrier.avg_transit_days.toFixed(1)
        )}
      </Td>
      <Td align="right">
        {exceptions === 0 ? (
          <span className="text-muted-soft">0</span>
        ) : (
          <span
            title={`${carrier.exceptions.lost} lost, ${carrier.exceptions.returned} returned, ${carrier.exceptions.exception} other exception`}
          >
            {formatNumber(exceptions)}
          </span>
        )}
      </Td>
    </tr>
  );
}

/**
 * What the numbers are made of, before anyone reads a rate off them.
 *
 * Each notice is a different missing thing with a different consequence, and
 * none is inferable from an empty table: a blank carrier row means "no channel
 * connected", "nothing shipped", or "the Amazon Fulfilment role was never
 * granted", and a seller can act on only one of those.
 */
function Coverage({ coverage }: { coverage: ShippingCoverage }) {
  const notices: { key: string; body: React.ReactNode }[] = [];

  if (coverage.amazon_connected && coverage.amazon_fulfilled === 0 && !coverage.has_fba_shipments) {
    notices.push({
      key: "fba",
      body: (
        <>
          No Amazon-fulfilled shipments here. They come from the fulfilled-shipments report, which
          needs the <span className="font-medium">Amazon Fulfilment</span> role — a different grant
          from the one your orders use. If you don&rsquo;t sell through FBA there is nothing
          missing; if you do, reauthorise from{" "}
          <Link href="/channels" className="font-medium underline underline-offset-2">
            Channels
          </Link>
          .
        </>
      ),
    });
  }

  if (coverage.packages > 0 && !coverage.has_deliveries) {
    notices.push({
      key: "deliveries",
      body: (
        <>
          Nothing has reported a delivery date yet, so on-time delivery and average transit days
          are empty. Amazon&rsquo;s own shipments never report one; merchant parcels and Shopify
          fulfilments do, once the carrier confirms delivery.
        </>
      ),
    });
  }

  if (!notices.length) return null;

  return (
    <div className="space-y-2">
      {notices.map((notice) => (
        <Alert key={notice.key} tone="info">
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
        This tab reads the parcels your channels report, so it needs at least one connected.
        Amazon brings merchant tracking and, with the Amazon Fulfilment role, its own shipments;
        Shopify brings fulfilments and tracking with your orders.
      </p>
      <div className="flex justify-center">
        <ButtonLink href="/channels" size="sm">
          Connect a channel
        </ButtonLink>
      </div>
    </div>
  );
}
