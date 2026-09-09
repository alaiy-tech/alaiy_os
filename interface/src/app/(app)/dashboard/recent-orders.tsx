import Link from "next/link";
import {
  ChannelBadge,
  EmptyRow,
  FlagChips,
  StatusText,
  TableFrame,
  Td,
  Th,
} from "@/components/data/table";
import { formatDateTime, formatMoney } from "@/lib/format";
import { hrefToString, selectedOrderKey } from "@/lib/listing";
import type { OrdersPage } from "@/lib/backend/types";

/**
 * The last ten orders, as a glance rather than as a tab.
 *
 * Deliberately not a small copy of the Orders table. There is no sort, no
 * filter, no pager and no detail panel: everything that makes Orders a place
 * to work is what would make this a second place to work, and the point of it
 * is to answer "anything obviously wrong?" in the two seconds before the
 * seller either moves on or clicks through.
 *
 * Newest first, *not* problems first — this is the one view in the product
 * where recency is the ordering, because "what has just come in" is the
 * question. The flags are still shown, and the alert bar above is what ranks
 * problems. Every row links into Orders with that order already open.
 */

export function RecentOrders({ page }: { page: OrdersPage }) {
  const { rows, rules } = page;

  return (
    <TableFrame minWidth="46rem">
      <thead>
        <tr>
          <Th>When</Th>
          <Th>Order</Th>
          <Th>Channel</Th>
          <Th>Customer</Th>
          <Th align="right">Amount</Th>
          <Th>Payment</Th>
          <Th>Flags</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={7}>
            Nothing has come in yet. New orders appear here as your channels
            sync.
          </EmptyRow>
        ) : (
          rows.map((order) => {
            // Straight into the Orders tab with this order's panel open — the
            // same link the table there builds, so the two cannot drift.
            const href = hrefToString({
              pathname: "/orders",
              query: { order: selectedOrderKey(order.channel, order.external_order_id) },
            });

            return (
              <tr
                key={selectedOrderKey(order.channel, order.external_order_id)}
                className="transition-colors hover:bg-primary-600/[0.04]"
              >
                <Td className="whitespace-nowrap text-muted">
                  {formatDateTime(order.order_date)}
                </Td>
                <Td className="font-medium">
                  <Link
                    href={href}
                    className="underline-offset-2 hover:text-primary-600 hover:underline"
                  >
                    {order.order_number || order.external_order_id}
                  </Link>
                </Td>
                <Td>
                  <ChannelBadge channel={order.channel} />
                </Td>
                <Td className="max-w-[10rem] truncate text-muted">
                  {order.customer_name || "—"}
                </Td>
                <Td align="right">{formatMoney(order.order_total, order.currency)}</Td>
                <Td>
                  <StatusText value={order.financial_status} />
                </Td>
                <Td>
                  <FlagChips flags={order.flags} rules={rules} />
                </Td>
              </tr>
            );
          })
        )}
      </tbody>
    </TableFrame>
  );
}
