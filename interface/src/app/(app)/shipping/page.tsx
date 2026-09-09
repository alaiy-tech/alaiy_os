import { requireOnboardedSession } from "@/lib/auth/dal";
import { Alert, Eyebrow } from "@/components/ui";
import { EmptyRow, TableFrame, Td, Th } from "@/components/data/table";
import { formatNumber } from "@/lib/format";
import { buildMockShippingData } from "@/lib/shipping/mock-data";
import {
  LATE_SHIPMENT_RATE_THRESHOLD,
  exceptionCount,
  trendFor,
  undispatched,
} from "@/lib/shipping/presentation";
import { HandlingTimeChart } from "./handling-time-chart";
import { LateShipmentRow } from "./late-shipment-row";

export const metadata = { title: "Shipping — Alaiy" };

/**
 * The Shipping tab: aggregate fulfilment health, not an order-by-order audit.
 *
 * Every data source the issue names — SP-API's Orders API, Shopify's
 * fulfilment events, carrier tracking, the WMS — is a real, buildable
 * integration; none of them is blocked the way Support's case API or
 * Ratings' review text is. There is just no backend module behind this tab
 * yet, so `buildMockShippingData` previews the whole pipeline at once.
 *
 * Almost entirely server-rendered, unlike Support and Ratings — there is no
 * manual-entry mechanism the issue asks for here, and no client-side
 * filtering either (the issue does not ask this tab to be filterable the
 * way Orders or Ratings are). The one place that needs the browser is the
 * chart's hover crosshair, which is its own small client island.
 */
export default async function ShippingPage() {
  await requireOnboardedSession();

  const { summary, handlingTimeTrend, annotations, carriers, lateShipments } =
    buildMockShippingData();

  const atRisk = undispatched(lateShipments);
  const lsrAtRisk = summary.lateShipmentRatePct.value >= LATE_SHIPMENT_RATE_THRESHOLD;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your data</Eyebrow>
        <h1 className="text-display-md">Shipping</h1>
        <p className="max-w-2xl text-[13px] text-muted">
          Fulfilment health in aggregate — handling time, carrier performance, and on-time rate —
          so a decline shows up before it becomes an Account Health warning.
        </p>
      </div>

      <Alert tone={lsrAtRisk ? "warn" : "info"}>
        Your Late Shipment Rate feeds Amazon&apos;s Account Health — currently{" "}
        <span className="font-semibold">{summary.lateShipmentRatePct.value.toFixed(1)}%</span>,
        against Amazon&apos;s {LATE_SHIPMENT_RATE_THRESHOLD.toFixed(0)}% threshold. This is meant
        to be the same figure Account Health shows in Seller Central — one pipeline, not a second
        calculation that could disagree with it.
      </Alert>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Avg. handling time"
          value={`${summary.avgHandlingHours.value}h`}
          trend={trendFor(summary.avgHandlingHours.value, summary.avgHandlingHours.previous, {
            higherIsBetter: false,
            unit: "h",
            digits: 0,
          })}
        />
        <MetricTile
          label="On-time dispatch rate"
          value={`${summary.onTimeDispatchPct.value}%`}
          trend={trendFor(summary.onTimeDispatchPct.value, summary.onTimeDispatchPct.previous, {
            higherIsBetter: true,
            unit: "pp",
            digits: 0,
          })}
        />
        <MetricTile
          label="On-time delivery rate"
          value={`${summary.onTimeDeliveryPct.value}%`}
          trend={trendFor(summary.onTimeDeliveryPct.value, summary.onTimeDeliveryPct.previous, {
            higherIsBetter: true,
            unit: "pp",
            digits: 0,
          })}
        />
        <MetricTile
          label="Late Shipment Rate"
          value={`${summary.lateShipmentRatePct.value.toFixed(1)}%`}
          trend={trendFor(
            summary.lateShipmentRatePct.value,
            summary.lateShipmentRatePct.previous,
            { higherIsBetter: false, unit: "pp" },
          )}
        />
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
            Handling time — last 30 days
          </h2>
          <p className="text-[11.5px] text-muted-soft">
            Order placed to dispatch confirmed. FBA orders are excluded — Amazon handles those, so
            there is no handling time of yours to measure.
          </p>
        </div>
        <div className="rounded-sm border border-line bg-white px-4 py-4">
          <HandlingTimeChart points={handlingTimeTrend} annotations={annotations} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          Carrier breakdown
        </h2>
        <TableFrame minWidth="44rem">
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
            {carriers.map((carrier) => (
              <tr key={carrier.id} className="border-b border-line/60 last:border-0">
                <Td className="font-medium">
                  {carrier.name}
                  {carrier.isFBA ? (
                    <span className="ml-1.5 text-[11px] font-normal text-muted-soft">
                      (Amazon&apos;s network)
                    </span>
                  ) : null}
                </Td>
                <Td align="right">{formatNumber(carrier.shipments)}</Td>
                <Td align="right">
                  <span className={carrier.onTimePct < 85 ? "font-semibold text-alert-ink" : ""}>
                    {carrier.onTimePct}%
                  </span>
                </Td>
                <Td align="right">{carrier.avgTransitDays.toFixed(1)}</Td>
                <Td align="right">{formatNumber(exceptionCount(carrier.exceptions))}</Td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
        {carriers.some((c) => c.onTimePct < 85) ? (
          <p className="text-[11.5px] leading-snug text-muted-soft">
            Delhivery&apos;s on-time rate is down this week — concentrated in a handful of Delhi
            NCR pin codes (110001, 110016, 122001), which points to a regional network disruption
            rather than a packaging or warehouse issue.
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
            Late shipments
          </h2>
          {atRisk.length ? (
            <p className="text-[12px] text-alert-ink">
              {atRisk.length} order{atRisk.length === 1 ? "" : "s"} not yet dispatched — ship these
              today to keep the Late Shipment Rate from crossing{" "}
              {LATE_SHIPMENT_RATE_THRESHOLD.toFixed(0)}%.
            </p>
          ) : null}
        </div>
        <TableFrame minWidth="40rem">
          <thead>
            <tr>
              <Th>Status</Th>
              <Th>Channel</Th>
              <Th>Order</Th>
              <Th>Carrier</Th>
              <Th>Expected ship date</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {lateShipments.length === 0 ? (
              <EmptyRow colSpan={6}>Nothing late or at risk right now.</EmptyRow>
            ) : (
              lateShipments.map((shipment) => (
                <LateShipmentRow key={shipment.id} shipment={shipment} />
              ))
            )}
          </tbody>
        </TableFrame>
      </section>
    </div>
  );
}

function MetricTile({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend: { label: string; direction: "up" | "down" | "flat"; tone: "ok" | "alert" | "neutral" };
}) {
  const arrow = trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→";
  const toneClass =
    trend.tone === "ok" ? "text-ok-ink" : trend.tone === "alert" ? "text-alert-ink" : "text-muted";

  return (
    <div className="rounded-sm border border-line bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        {label}
      </p>
      <p className="pt-1 font-data text-display-sm text-primary-600">{value}</p>
      <p className={`font-data text-[12px] font-medium ${toneClass}`}>
        <span aria-hidden>{arrow}</span> {trend.label}
        <span className="pl-1 font-sans text-muted-soft">vs last week</span>
      </p>
    </div>
  );
}
