import { Pill } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import {
  BUYBOX_UNDERCUT,
  buyBoxDrop,
  needsPricingAttention,
  recommendedPrice,
} from "@/lib/profitability/presentation";
import type { ChannelPnlRow } from "@/lib/profitability/types";

/**
 * Per-SKU Buy Box standing, Amazon only.
 *
 * The recommendation is a floor-safe starting point — the Buy Box price less
 * BUYBOX_UNDERCUT — and never anything closer to a repricing engine. It is
 * offered as something the seller takes to Seller Central themselves; nothing
 * here changes a price. It is also withheld where it would be advice against
 * the seller's own interest: undercutting a Buy Box we already hold gives away
 * margin for nothing.
 *
 * What this panel deliberately does not do is project the revenue a price
 * change would recover. That needs an elasticity model fitted to sales
 * velocity at different price points, and there isn't one — a figure invented
 * for the shape of the sentence would be the most persuasive number on the
 * page and the only one nothing produced.
 */
export function BuyBoxPanel({
  rows,
  currency,
}: {
  rows: ChannelPnlRow[];
  currency: string;
}) {
  const amazonRows = rows.filter((row) => row.buy_box_win_pct !== null);
  if (amazonRows.length === 0) return null;

  const attention = amazonRows
    .filter(needsPricingAttention)
    .sort((a, b) => (a.buy_box_win_pct ?? 0) - (b.buy_box_win_pct ?? 0));
  const healthy = amazonRows
    .filter((row) => !needsPricingAttention(row))
    .sort((a, b) => (b.buy_box_win_pct ?? 0) - (a.buy_box_win_pct ?? 0));

  const asOf = amazonRows.find((row) => row.buy_box_as_of)?.buy_box_as_of;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          Buy Box — Amazon
        </h2>
        <p className="text-[12px] text-muted">
          A recommendation here is a floor-safe starting point — Buy Box price minus{" "}
          {formatMoney(BUYBOX_UNDERCUT, currency)} — not an automated repricing action. You still make
          the change in Seller Central.
          {asOf ? ` Read ${formatDate(asOf)}.` : null}
        </p>
      </div>

      {attention.length ? (
        <ul className="space-y-2">
          {attention.map((row) => (
            <BuyBoxRow key={row.sku} row={row} currency={currency} />
          ))}
        </ul>
      ) : null}

      {healthy.length ? (
        <details className="group rounded-sm border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[12px] text-muted transition-colors hover:text-primary-600">
            <span aria-hidden className="text-[10px] transition-transform group-open:rotate-90">
              ▶
            </span>
            {healthy.length} SKU{healthy.length === 1 ? "" : "s"} winning the Buy Box
            comfortably
          </summary>
          <ul className="space-y-2 border-t border-line px-3.5 py-3">
            {healthy.map((row) => (
              <li key={row.sku} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className="font-medium text-ink">{row.title}</span>
                <Pill tone="ok">{row.buy_box_win_pct?.toFixed(0)}% win rate</Pill>
                <Prices row={row} currency={currency} className="text-muted-soft" />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function BuyBoxRow({ row, currency }: { row: ChannelPnlRow; currency: string }) {
  const drop = buyBoxDrop(row);
  const recommended = row.buy_box_price !== null ? recommendedPrice(row.buy_box_price) : null;
  // Undercutting our own winning offer would be a recommendation to give away
  // margin for a Buy Box we already hold.
  const worthRecommending =
    recommended !== null &&
    !row.buy_box_is_ours &&
    (row.current_price === null || recommended < row.current_price);

  return (
    <li className="space-y-1.5 rounded-sm border border-alert/30 bg-alert-soft px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{row.title}</span>
        <Pill tone="alert">{row.buy_box_win_pct?.toFixed(0)}% win rate</Pill>
        {drop !== null ? (
          <span className="text-[11.5px] text-alert-ink">
            down {drop.toFixed(0)} points from {row.buy_box_win_pct_prior?.toFixed(0)}%
            {row.buy_box_prior_date ? ` on ${formatDate(row.buy_box_prior_date)}` : null}
          </span>
        ) : null}
      </div>

      <p className="text-[12.5px] text-alert-ink">
        <Prices row={row} currency={currency} />
        {worthRecommending ? (
          <>
            {" "}
            · Suggested: drop to{" "}
            <span className="font-semibold">{formatMoney(recommended, currency)}</span>
          </>
        ) : null}
      </p>

      {row.buy_box_is_ours ? (
        <p className="text-[11.5px] leading-snug text-alert-ink/80">
          You hold the Buy Box right now — this win rate is the share of the reporting
          window you held it, so the losses were at other times of day.
        </p>
      ) : null}
    </li>
  );
}

/**
 * Our price against the Buy Box price.
 *
 * Either can be absent — a listing with no price synced, or an ASIN whose live
 * pricing read failed — and "—" is shown rather than ₹0, which would read as a
 * free product and make the price gap look enormous.
 */
function Prices({
  row,
  currency,
  className,
}: {
  row: ChannelPnlRow;
  currency: string;
  className?: string;
}) {
  return (
    <span className={className}>
      Your price{" "}
      {row.current_price !== null ? formatMoney(row.current_price, currency) : "—"} · Buy
      Box {row.buy_box_price !== null ? formatMoney(row.buy_box_price, currency) : "—"}
    </span>
  );
}
