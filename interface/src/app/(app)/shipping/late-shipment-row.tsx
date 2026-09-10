import Link from "next/link";
import { ChannelBadge, Td } from "@/components/data/table";
import { Pill } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { hrefToString, selectedOrderKey } from "@/lib/listing";
import type { AtRiskShipment, ShippedLateShipment } from "@/lib/shipping/types";

/**
 * One late or at-risk shipment.
 *
 * "View in Orders" is a real deep link now that these are real orders — it
 * opens the order on the Orders tab with its detail panel expanded, which is
 * the click-through this row always meant to offer and could not while the
 * order numbers were fabricated.
 *
 * The two shapes are kept apart in the types rather than merged behind a
 * status flag, because they carry genuinely different things: an at-risk order
 * has no carrier and no days-late, since nothing has shipped to have either.
 */
export function LateShipmentRow({
  shipment,
  status,
}: {
  shipment: AtRiskShipment | ShippedLateShipment;
  status: "at_risk" | "shipped_late";
}) {
  const daysLate = shipment.days_late;

  return (
    <tr className="transition-colors hover:bg-primary-600/[0.04]">
      <Td>
        {status === "at_risk" ? (
          <Pill tone="alert">Not dispatched</Pill>
        ) : (
          <Pill tone="warn">
            Shipped {daysLate !== null ? `${daysLate.toFixed(daysLate < 1 ? 1 : 0)}d` : ""} late
          </Pill>
        )}
      </Td>
      <Td>
        <ChannelBadge channel={shipment.channel} />
      </Td>
      <Td className="font-medium">
        {shipment.order_number ?? shipment.external_order_id}
      </Td>
      <Td className="whitespace-nowrap text-muted">
        {shipment.carrier ?? <span className="text-muted-soft">—</span>}
      </Td>
      <Td className="whitespace-nowrap text-muted">
        {shipment.promised_ship_by ? (
          formatDate(shipment.promised_ship_by)
        ) : (
          <span className="text-muted-soft">—</span>
        )}
      </Td>
      <Td>
        <Link
          href={hrefToString({
            pathname: "/orders",
            query: { order: selectedOrderKey(shipment.channel, shipment.external_order_id) },
          })}
          className="whitespace-nowrap text-primary-600 underline-offset-2 hover:underline"
        >
          View in Orders <span aria-hidden>↗</span>
        </Link>
      </Td>
    </tr>
  );
}
