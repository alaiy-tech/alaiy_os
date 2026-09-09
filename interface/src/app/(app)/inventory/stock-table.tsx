import { EmptyRow, TableFrame, Td, Th } from "@/components/data/table";
import { formatNumber } from "@/lib/format";
import {
  COVER_BANDS,
  coverLabel,
  coverPresentation,
  sourceLabel,
} from "@/lib/inventory/presentation";
import type { StockPage, StockRow } from "@/lib/inventory/types";

/**
 * Inventory at product-group grain: what you have, where, and when it runs out.
 *
 * A seller does not have one inventory number, they have three — the
 * warehouse's, Shopify's, and what Amazon holds in FBA — and none of the three
 * says when they run out. So every stock column is shown separately rather
 * than summed into one comfortable figure, and days of cover is the column the
 * table is sorted by, because the reorder decision is the reason to open it.
 *
 * Two things the table refuses to do:
 *
 *   * **No cover is not zero cover.** A SKU with stock and no sales in the
 *     window has no rate to divide by; painting it critical would send someone
 *     to reorder the one product they should not.
 *   * **The three numbers are never reconciled.** Where Shopify disagrees with
 *     the warehouse the row says so and by how much, because that gap is the
 *     oversell risk — averaging it away would hide the finding.
 */

export function StockTable({ page }: { page: StockPage }) {
  return (
    <div className="space-y-2">
      <TableFrame minWidth="72rem">
        <thead>
          <tr>
            <Th>Product</Th>
            <Th align="right">Warehouse</Th>
            <Th align="right">Shopify</Th>
            <Th align="right">Amazon FBA</Th>
            <Th align="right">Total</Th>
            <Th align="right">Per day</Th>
            <Th align="right">Cover</Th>
            <Th align="right">Incoming</Th>
            <Th>Source</Th>
            {/* Visible and inert, exactly as the spec asks: the column has to
                exist so the shape of Profitability is legible, and it must not
                pretend to hold a number. */}
            <Th align="right">COGS</Th>
          </tr>
        </thead>
        <tbody>
          {page.rows.length === 0 ? (
            <EmptyRow colSpan={10}>
              No products yet. Stock appears here once your channels sync.
            </EmptyRow>
          ) : (
            page.rows.map((row) => <Row key={row.group_id} row={row} hasWms={page.has_wms} />)
          )}
        </tbody>
      </TableFrame>

      <Legend thresholds={page.thresholds} />
    </div>
  );
}

function Row({ row, hasWms }: { row: StockRow; hasWms: boolean }) {
  const cover = coverPresentation(row.band);
  const source = sourceLabel(row.source);

  return (
    <tr className="transition-colors hover:bg-primary-600/[0.04]">
      <Td className="font-medium">
        <span className="block max-w-[16rem] truncate">{row.name}</span>
        <span className="block truncate text-[11.5px] text-muted-soft">{row.brand_sku}</span>
      </Td>

      <Td align="right">
        <Qty value={row.warehouse_qty} />
        {/* The oversell risk, on the row it belongs to. A footnote elsewhere
            would be a finding nobody connects to a product. */}
        {row.discrepancy ? (
          <span
            className="block text-[11px] text-warn-ink"
            title={`Shopify shows ${formatNumber(row.shopify_qty)} against the warehouse's ${formatNumber(row.warehouse_qty)}. A campaign could oversell the difference.`}
          >
            {formatNumber(row.discrepancy.units)} off Shopify
          </span>
        ) : null}
      </Td>

      <Td align="right">
        <Qty value={row.shopify_qty} />
      </Td>
      <Td align="right">
        <Qty value={row.amazon_fba_qty} />
        {row.amazon_fba_qty === 0 ? (
          <span
            className="block text-[11px] text-warn-ink"
            title="Amazon makes a listing inactive when FBA stock reaches zero, and it goes live again on its own once inventory arrives."
          >
            listing at risk
          </span>
        ) : null}
      </Td>

      <Td align="right" className="font-semibold">
        {formatNumber(row.total_available)}
      </Td>

      <Td align="right" className="text-muted">
        {row.sell_through === null ? (
          <span className="text-muted-soft">—</span>
        ) : (
          <span title={`Averaged over the last ${row.velocity_days} days.`}>
            {row.sell_through.toFixed(1)}
          </span>
        )}
      </Td>

      <Td align="right">
        <span className={`inline-flex items-center gap-1.5 ${cover.cell}`} title={cover.blurb}>
          <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${cover.dot}`} />
          {coverLabel(row.days_of_cover)}
        </span>
      </Td>

      <Td align="right">
        {row.incoming_units ? (
          <span title={row.next_arrival ? `Expected ${row.next_arrival}.` : undefined}>
            {formatNumber(row.incoming_units)}
            {row.next_arrival ? (
              <span className="block text-[11px] text-muted-soft">{row.next_arrival}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-soft">—</span>
        )}
      </Td>

      <Td>
        <span
          className="rounded-xs border border-line bg-surface px-1.5 py-0.5 font-sans text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted"
          title={hasWms ? source.blurb : "No WMS is configured, so ERPNext is the stock master."}
        >
          {source.label}
        </span>
      </Td>

      <Td align="right">
        <span className="text-muted-soft" title="Coming soon — needed for Profitability.">
          —
        </span>
      </Td>
    </tr>
  );
}

/**
 * A stock figure, or the absence of one.
 *
 * Null means the channel is not connected or did not report — which is not
 * zero, and a zero here would read as "you have none of this" on a product
 * sitting in a warehouse.
 */
function Qty({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="text-muted-soft" title="Not reported by this source.">
        —
      </span>
    );
  }
  return <>{formatNumber(value)}</>;
}

/**
 * What the colours mean, and where the lines are.
 *
 * The bands are configurable per workspace, so the legend reads the numbers it
 * was given rather than hard-coding the defaults into the copy — a brand with
 * a six-week lead time changes the thresholds and this follows.
 */
function Legend({ thresholds }: { thresholds: StockPage["thresholds"] }) {
  const range: Record<string, string> = {
    critical: `under ${thresholds.critical} days`,
    low: `${thresholds.critical}–${thresholds.low} days`,
    watch: `${thresholds.low + 1}–${thresholds.watch} days`,
    healthy: `over ${thresholds.watch} days`,
    unknown: "no sales in the window",
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
      <span className="font-sans font-semibold uppercase tracking-[0.12em] text-primary-500">
        Cover
      </span>
      {COVER_BANDS.map((band) => {
        const presentation = coverPresentation(band);
        return (
          <span key={band} className="flex items-center gap-1.5" title={presentation.blurb}>
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${presentation.dot}`} />
            {presentation.label}
            <span className="text-muted-soft">{range[band]}</span>
          </span>
        );
      })}
    </div>
  );
}
