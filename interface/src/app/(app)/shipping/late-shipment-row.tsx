import { ChannelBadge, Td } from "@/components/data/table";
import { Pill } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { LateShipment } from "@/lib/shipping/types";

/**
 * One late or at-risk shipment. "View in Orders" is inert rather than a real
 * link — these order numbers are mock, so a real `/orders?order=...` link
 * would only ever land on "that order could not be loaded", which is a worse
 * demonstration of the intended cross-tab click-through than being honest
 * that this is mock data.
 */
export function LateShipmentRow({ shipment }: { shipment: LateShipment }) {
  return (
    <tr className="transition-colors hover:bg-primary-600/[0.04]">
      <Td>
        {shipment.status === "at_risk" ? (
          <Pill tone="alert">Not dispatched</Pill>
        ) : (
          <Pill tone="warn">Shipped {shipment.daysLate}d late</Pill>
        )}
      </Td>
      <Td>
        <ChannelBadge channel={shipment.channel} />
      </Td>
      <Td className="font-medium">{shipment.orderNumber}</Td>
      <Td className="whitespace-nowrap text-muted">{shipment.carrier}</Td>
      <Td className="whitespace-nowrap text-muted">{formatDate(shipment.expectedShipDate)}</Td>
      <Td>
        <span
          className="whitespace-nowrap text-muted-soft"
          title="Mock data — this order doesn't exist in your real Orders tab yet."
        >
          View in Orders <span aria-hidden>↗</span>
        </span>
      </Td>
    </tr>
  );
}
