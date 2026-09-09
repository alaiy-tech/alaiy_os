import Link from "next/link";
import {
  EmptyRow,
  StatusText,
  TableFrame,
  Td,
  Th,
} from "@/components/data/table";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { hrefToString, selectedOrderKey } from "@/lib/listing";
import type { ContributingOrders, HealthMetric } from "@/lib/backend/types";

/**
 * The orders pulling one metric, under the tile the seller expanded.
 *
 * This is where the tab stops being a scoreboard. A metric near its limit is
 * only actionable once you know which orders are spending the headroom, and
 * the two we can attribute are attributed two different ways — so the panel
 * says which basis it is using rather than presenting both as one list.
 *
 * Every row links into Orders with that order open, because acting on it
 * happens there or in Seller Central, never here.
 */

export function Contributing({
  metric,
  data,
}: {
  metric: HealthMetric;
  data: ContributingOrders | null;
}) {
  if (!data) {
    return (
      <Note>
        Couldn&rsquo;t load the orders behind {metric.metric_label} just now.
        The figures above are unaffected.
      </Note>
    );
  }

  // Not the same as an empty list, and the difference matters: "no orders are
  // responsible for this" is a claim, and this metric cannot make it.
  if (!data.supported) {
    return (
      <Note>
        Amazon reports {metric.metric_label} as a single percentage and
        doesn&rsquo;t say which orders it came from — so there is nothing here
        to list. Seller Central is the only place to break this one down.
      </Note>
    );
  }

  const late = data.basis === "unshipped_past_promise";

  return (
    <section
      aria-label={`Orders behind ${metric.metric_label}`}
      className="space-y-2 rounded-sm border border-highlight-400 bg-highlight-100/60 p-3.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-display-xs text-primary-600">
          Behind {metric.metric_label}
        </h3>
        <p className="text-[12px] text-muted">
          {late
            ? "Unshipped, at or past the date you promised Amazon."
            : "Orders with 1- or 2-star feedback, worst first."}
        </p>
      </div>

      {!late ? (
        <p className="text-[12px] text-muted">
          Feedback is the part of Order Defect Rate we can attribute per order.
          A-to-Z claims and chargebacks arrive as counts only —{" "}
          {formatNumber(metric.defect_guarantees)} and{" "}
          {formatNumber(metric.defect_chargebacks)} respectively in the last 30
          days.
        </p>
      ) : null}

      <TableFrame minWidth={late ? "44rem" : "40rem"}>
        <thead>
          <tr>
            <Th>Order</Th>
            {late ? <Th>Promised by</Th> : <Th>Rating</Th>}
            <Th>Products</Th>
            {late ? <Th align="right">Units</Th> : <Th>Comment</Th>}
            {late ? <Th align="right">Amount</Th> : <Th>When</Th>}
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 ? (
            <EmptyRow colSpan={5}>
              {late
                ? "Nothing is unshipped past its promised date right now."
                : "No negative feedback in the synced window."}
            </EmptyRow>
          ) : (
            data.rows.map((row) => (
              <tr
                key={row.external_order_id}
                className="transition-colors hover:bg-primary-600/[0.04]"
              >
                <Td className="font-medium">
                  <Link
                    href={hrefToString({
                      pathname: "/orders",
                      query: { order: selectedOrderKey("amazon", row.external_order_id) },
                    })}
                    className="underline-offset-2 hover:text-primary-600 hover:underline"
                  >
                    {row.order_number || row.external_order_id}
                  </Link>
                </Td>

                {late ? (
                  <Td className="whitespace-nowrap text-warn-ink">
                    {formatDateTime(row.promised_ship_by)}
                  </Td>
                ) : (
                  <Td className="whitespace-nowrap">
                    <Stars rating={row.rating ?? null} />
                  </Td>
                )}

                <Td className="max-w-[16rem]">
                  <span className="block truncate" title={row.products.join(", ")}>
                    {row.products.join(", ") || "—"}
                  </span>
                </Td>

                {late ? (
                  <Td align="right">{formatNumber(row.units)}</Td>
                ) : (
                  <Td className="max-w-[18rem] text-muted">
                    <span className="block truncate" title={row.comment ?? undefined}>
                      {row.comment || "—"}
                    </span>
                  </Td>
                )}

                {late ? (
                  <Td align="right">{formatMoney(row.order_total, row.currency)}</Td>
                ) : (
                  <Td className="whitespace-nowrap text-muted">
                    {row.feedback_date || "—"}
                  </Td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </TableFrame>
    </section>
  );
}

/**
 * A feedback rating.
 *
 * The number is what gets read; the stars are the glance. Amazon counts 1 and
 * 2 as negative, and everything in this table is one of those, so the tone is
 * fixed rather than computed.
 */
function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <StatusText />;
  return (
    <span className="text-alert-ink" title={`${rating} out of 5`}>
      <span aria-hidden>{"★".repeat(rating)}</span>
      <span className="pl-1 font-data tabular-nums">{rating}/5</span>
    </span>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-sm border border-line bg-surface px-3.5 py-2.5 text-[13px] text-muted">
      {children}
    </p>
  );
}
