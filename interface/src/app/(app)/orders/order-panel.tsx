import Link from "next/link";
import type { ReactNode } from "react";
import { ChannelBadge, FlagChips, StatusText } from "@/components/data/table";
import { CloseOnEscape } from "@/app/(app)/orders/close-on-escape";
import { pressClass } from "@/components/ui";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import type { ChannelOrderDetail, OrderFlagRules } from "@/lib/backend/types";
import { orderFlags } from "@/lib/orders/flags";
import { hrefToString } from "@/lib/listing";

/**
 * One order, slid in over the table.
 *
 * A panel rather than a page, because investigating an order is a step inside
 * scanning them: the seller opens one, reads it, closes it and carries on down
 * the same list. A route change would lose their place in it.
 *
 * It stops at the Ask panel's edge rather than covering the viewport, so a
 * question asked about this order is still on screen beside the answer — which
 * is the whole reason Ask is docked and not a dialog. There is no scrim: the
 * table behind stays live, and clicking a different row swaps the panel.
 *
 * Everything in it comes from the URL, so a specific order is a link a seller
 * can send to whoever is handling it.
 */

/** What `listingHref` builds: good for a `Link`, and stringifiable for Escape. */
type ListingHref = { pathname: string; query: Record<string, string> };

export function OrderPanel({
  order,
  rules,
  closeHref,
}: {
  /** Null when the order could not be read — the table is still fine. */
  order: ChannelOrderDetail | null;
  rules: OrderFlagRules;
  closeHref: ListingHref;
}) {
  const title = order?.order_number || order?.external_order_id || "Order";

  return (
    <>
      <CloseOnEscape href={hrefToString(closeHref)} />
      <aside
        role="dialog"
        aria-label={`Order ${title}`}
        // Floating over the page, so it takes the one shadow the system allows
        // a surface that genuinely floats. `right-ask-panel` is the token the
        // Ask panel sets its own width from.
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[27rem] flex-col border-l border-line bg-canvas shadow-float lg:right-ask-panel"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
              Order
            </p>
            <h2 className="truncate font-data text-[17px] font-semibold text-primary-600">
              {title}
            </h2>
          </div>
          <Link
            href={closeHref}
            aria-label="Close order details"
            title="Close (Esc)"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-muted transition-colors hover:bg-primary-600/5 hover:text-primary-600"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </Link>
        </header>

        {order ? (
          <Body order={order} rules={rules} />
        ) : (
          <p className="px-4 py-8 text-[13px] text-muted">
            That order could not be loaded. It may have been removed by a sync,
            or the backend may be unreachable.
          </p>
        )}
      </aside>
    </>
  );
}

function Body({
  order,
  rules,
}: {
  order: ChannelOrderDetail;
  rules: OrderFlagRules;
}) {
  const flags = orderFlags(order.flags);

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <ChannelBadge channel={order.channel} />
        {/* Unlike the table, no em dash for an unflagged order: the column
            needed a placeholder to stay legible down four hundred rows, and a
            dash floating beside one channel badge is just a dash. */}
        {order.flags.length ? <FlagChips flags={order.flags} rules={rules} /> : null}
      </div>

      {/* Each flag spelled out. In the table the chip is all there is room for;
          here there is room to say what it means and which threshold it
          crossed, which is what turns a red dot into something to act on. */}
      {flags.length ? (
        <ul className="space-y-1.5 rounded-sm border border-line bg-white px-3.5 py-3">
          {flags.map((flag) => (
            <li key={flag.key} className="text-[12.5px] leading-snug text-muted">
              <span className="font-medium text-ink">{flag.label}.</span>{" "}
              {flag.explain(rules)}
            </li>
          ))}
        </ul>
      ) : null}

      <Facts>
        <Fact label="Placed">{formatDate(order.order_date)}</Fact>
        <Fact label="Customer">{order.customer_name || "—"}</Fact>
        <Fact label="Payment">
          <StatusText value={order.financial_status} />
        </Fact>
        <Fact label="Fulfilment">
          <StatusText value={order.fulfillment_status} />
        </Fact>
        <Fact label="Items">
          {formatNumber(order.line_count)} lines, {formatNumber(order.units)} units
        </Fact>
        <Fact label="Order total">
          {formatMoney(order.order_total, order.currency)}
        </Fact>
        <Fact label="Last synced">{formatDateTime(order.last_synced_at)}</Fact>
        <Fact label="Channel order id">
          <span className="break-all font-data text-[12px]">
            {order.external_order_id}
          </span>
        </Fact>
      </Facts>

      <section className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          Line items
        </h3>
        <div className="overflow-hidden rounded-sm border border-line bg-white">
          <table className="w-full border-collapse text-left font-data text-[12.5px]">
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.name} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-2 align-top">
                    <span className="font-medium text-ink">{line.sku || "—"}</span>
                    <span className="block text-[11.5px] text-muted">
                      {line.product_title || ""}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right align-top tabular-nums text-muted">
                    ×{formatNumber(line.qty)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums">
                    {formatMoney(line.line_total, line.currency ?? order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Amazon splits an order across shipments, and a Shopify order can be
            fulfilled in parts. Neither breakdown is synced, so the panel says
            so rather than presenting one order's lines as one parcel. */}
        <p className="text-[11.5px] leading-snug text-muted-soft">
          Shipments and tracking are not synced yet, so this is the order as
          placed — not how it went out.
        </p>
      </section>

      {order.external_url ? (
        <a
          href={order.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${pressClass({ size: "sm" })} w-full`}
        >
          View in {order.destination ?? "the channel"}
          <span aria-hidden>↗</span>
        </a>
      ) : (
        // Nothing to act on here, and no link either: saying why beats a
        // button that lands on a 404.
        <p className="text-[12px] text-muted">
          No link to the channel — that connection has not reported a store
          address yet. Reconnect it on Channels to get one.
        </p>
      )}
    </div>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-sm border border-line bg-white px-3.5 py-3">
      {children}
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        {label}
      </dt>
      <dd className="font-data text-[13px] text-ink">{children}</dd>
    </div>
  );
}
