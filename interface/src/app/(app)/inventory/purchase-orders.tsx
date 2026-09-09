import { EmptyRow, TableFrame, Td, Th } from "@/components/data/table";
import { daysUntil } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { coverLabel, coverPresentation } from "@/lib/inventory/presentation";
import { Pill } from "@/components/ui";
import type { PurchaseOrder, StockRow } from "@/lib/inventory/types";

/**
 * Open purchase orders, sorted by how urgently they are needed.
 *
 * Read-only, and that is the scope decision rather than a shortcut: purchase
 * orders live in ERPNext, this tab shows them, and nothing here writes back. So
 * the panel ends in a link out to ERPNext rather than a "New PO" button that
 * would have to be explained away.
 *
 * Sorted by the days of cover of what each PO restocks, lowest first, per the
 * spec — a PO for something with four days left is the one worth chasing, and
 * arrival date alone would bury it under an earlier one for a product with
 * plenty. Where the two disagree, the panel says which arrival is already too
 * late, because that is the sentence the seller acts on.
 */

export function PurchaseOrders({
  orders,
  rows,
}: {
  orders: PurchaseOrder[];
  /** For the stockout-before-arrival check, matched on SKU. */
  rows: StockRow[];
}) {
  const coverBySku = new Map(rows.map((row) => [row.brand_sku, row]));

  return (
    <section aria-label="Purchase orders" className="space-y-2 pt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-display-sm">Purchase orders</h2>
        {/* Not a press: it leaves the product. */}
        <a
          href="https://os.alaiy.com/app/purchase-order/new"
          target="_blank"
          rel="noreferrer noopener"
          className="text-[12px] text-muted underline-offset-2 hover:text-primary-600 hover:underline"
        >
          Create a PO in ERPNext ↗
        </a>
      </div>

      <TableFrame minWidth="52rem">
        <thead>
          <tr>
            <Th>PO</Th>
            <Th>Supplier</Th>
            <Th>SKUs</Th>
            <Th align="right">Units</Th>
            <Th>Expected</Th>
            <Th>Status</Th>
            <Th align="right">Cover</Th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <EmptyRow colSpan={7}>
              No purchase orders. They appear here from ERPNext.
            </EmptyRow>
          ) : (
            orders.map((order) => {
              const cover = coverPresentation(
                order.lowest_cover === null
                  ? "unknown"
                  : order.lowest_cover < 7
                    ? "critical"
                    : order.lowest_cover <= 14
                      ? "low"
                      : order.lowest_cover <= 30
                        ? "watch"
                        : "healthy",
              );
              const late = stocksOutFirst(order, coverBySku);

              return (
                <tr
                  key={order.po_number}
                  className="transition-colors hover:bg-primary-600/[0.04]"
                >
                  <Td className="font-medium">{order.po_number}</Td>
                  <Td className="text-muted">{order.supplier}</Td>
                  <Td className="max-w-[14rem]">
                    <span className="block truncate" title={order.skus.join(", ")}>
                      {order.skus.join(", ")}
                    </span>
                  </Td>
                  <Td align="right">{formatNumber(order.units)}</Td>
                  <Td className="whitespace-nowrap">
                    {order.expected_arrival || "—"}
                    {/* The whole point of putting cover beside a PO: an arrival
                        that lands after the stockout is a phone call, not a
                        row in a table. */}
                    {late ? (
                      <span className="block text-[11px] text-alert-ink">
                        {late === 1 ? "1 day short" : `${late} days short`}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <StatusPill status={order.status} />
                  </Td>
                  <Td align="right">
                    <span className={cover.cell} title={cover.blurb}>
                      {coverLabel(order.lowest_cover)}
                    </span>
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableFrame>
    </section>
  );
}

/**
 * How many days short the arrival is, or null when it lands in time.
 *
 * Only for a PO still coming: a received one cannot be late, however tight the
 * cover on what it restocked was.
 */
function stocksOutFirst(
  order: PurchaseOrder,
  coverBySku: Map<string, StockRow>,
): number | null {
  if (order.status === "received" || !order.expected_arrival) return null;

  const cover = order.skus
    .map((sku) => coverBySku.get(sku)?.days_of_cover)
    .filter((days): days is number => typeof days === "number");
  if (!cover.length) return null;

  const runsOutIn = Math.min(...cover);
  // Calendar days, both sides at local midnight. Diffing a date against the
  // current *time* loses a day whenever the clock is past midnight, which
  // under-reported how late an arrival was by exactly one day.
  const arrivesIn = daysUntil(order.expected_arrival, new Date());
  if (!Number.isFinite(arrivesIn)) return null;

  const short = arrivesIn - runsOutIn;
  return short > 0 ? short : null;
}

function StatusPill({ status }: { status: PurchaseOrder["status"] }) {
  if (status === "received") return <Pill tone="ok">Received</Pill>;
  if (status === "in_transit") return <Pill tone="accent">In transit</Pill>;
  return <Pill tone="neutral">Open</Pill>;
}
