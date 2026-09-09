import { Pill } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { needsPricingAttention, recommendedPrice } from "@/lib/profitability/presentation";
import type { ChannelPnlRow } from "@/lib/profitability/types";

/**
 * Per-SKU Buy Box standing, Amazon only.
 *
 * The recommendation is exactly the issue's V1 heuristic — Buy Box price
 * minus ₹5 — never anything closer to a repricing engine. It is offered as
 * a starting point Jordan takes to Seller Central themselves; nothing here
 * changes a price.
 */
export function BuyBoxPanel({ rows }: { rows: ChannelPnlRow[] }) {
  const amazonRows = rows.filter((row) => row.buyBoxWinPct !== null);
  if (amazonRows.length === 0) return null;

  const attention = amazonRows.filter(needsPricingAttention);
  const healthy = amazonRows.filter((row) => !needsPricingAttention(row));

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          Buy Box — Amazon
        </h2>
        <p className="text-[12px] text-muted">
          A recommendation here is a floor-safe starting point — Buy Box price minus ₹5 — not an
          automated repricing action. You still make the change in Seller Central.
        </p>
      </div>

      {attention.length ? (
        <ul className="space-y-2">
          {attention.map((row) => (
            <BuyBoxRow key={row.sku} row={row} />
          ))}
        </ul>
      ) : null}

      {healthy.length ? (
        <details className="group rounded-sm border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[12px] text-muted transition-colors hover:text-primary-600">
            <span aria-hidden className="text-[10px] transition-transform group-open:rotate-90">
              ▶
            </span>
            {healthy.length} SKU{healthy.length === 1 ? "" : "s"} winning the Buy Box comfortably
          </summary>
          <ul className="space-y-2 border-t border-line px-3.5 py-3">
            {healthy.map((row) => (
              <li key={row.sku} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className="font-medium text-ink">{row.title}</span>
                <Pill tone="ok">{row.buyBoxWinPct}% win rate</Pill>
                <span className="text-muted-soft">
                  Your price {formatMoney(row.currentPrice, "INR")} · Buy Box{" "}
                  {formatMoney(row.buyBoxPrice, "INR")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function BuyBoxRow({ row }: { row: ChannelPnlRow }) {
  const dropped =
    row.buyBoxWinPctSevenDaysAgo !== null &&
    row.buyBoxWinPct !== null &&
    row.buyBoxWinPctSevenDaysAgo - row.buyBoxWinPct >= 10;
  const recommended = row.buyBoxPrice !== null ? recommendedPrice(row.buyBoxPrice) : null;

  return (
    <li className="space-y-1.5 rounded-sm border border-alert/30 bg-alert-soft px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{row.title}</span>
        <Pill tone="alert">{row.buyBoxWinPct}% win rate</Pill>
        {dropped ? (
          <span className="text-[11.5px] text-alert-ink">
            down from {row.buyBoxWinPctSevenDaysAgo}% a week ago
          </span>
        ) : null}
      </div>

      <p className="text-[12.5px] text-alert-ink">
        Your price {formatMoney(row.currentPrice, "INR")} · Buy Box price{" "}
        {formatMoney(row.buyBoxPrice, "INR")}
        {recommended !== null ? (
          <>
            {" "}
            · Suggested: drop to <span className="font-semibold">{formatMoney(recommended, "INR")}</span>
          </>
        ) : null}
      </p>

      {row.projectedBuyBoxRecoveryPct !== undefined ? (
        <p className="text-[11.5px] leading-snug text-alert-ink/80">
          Projected: recover roughly {row.projectedBuyBoxRecoveryPct}% Buy Box share — an estimated{" "}
          {formatMoney(row.projectedMonthlyRevenueImpact ?? 0, "INR")} in additional monthly
          revenue at current sales velocity.
        </p>
      ) : null}
    </li>
  );
}
