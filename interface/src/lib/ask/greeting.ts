import type { DashboardTiles } from "@/lib/backend/types";
import { formatMoney, formatNumber, formatPercent, percentDelta, pointDelta } from "@/lib/format";

/**
 * Ask Alaiy's opening message.
 *
 * The spec is specific about this: the first screen after onboarding has Alaiy
 * sending "first message with real numbers from their data". So this is built
 * from the same tile figures the Home grid shows — no model involved, and
 * nothing claimed that the data does not support.
 */
export function openingMessage(
  tiles: DashboardTiles,
  firstName?: string,
): string[] {
  const hello = firstName ? `Hi ${firstName}.` : "Hi.";

  if (!tiles.has_any_orders) {
    return [
      `${hello} Nothing has arrived from your channels yet.`,
      "As soon as your import finishes, your numbers show up here and on the tiles to the left.",
    ];
  }

  if (tiles.orders.value === 0) {
    return [
      `${hello} No orders in the last ${tiles.window.days} days.`,
      "Your earlier data is in, so the tiles will fill in again as soon as sales resume.",
    ];
  }

  const money = formatMoney(tiles.gmv.value, tiles.currency);
  const orders = formatNumber(tiles.orders.value);
  const orderWord = tiles.orders.value === 1 ? "order" : "orders";
  const gmvDelta = percentDelta(tiles.gmv.change_pct);

  const lead =
    gmvDelta.direction === "none"
      ? `${hello} You've done ${money} across ${orders} ${orderWord} in the last ${tiles.window.days} days.`
      : `${hello} You've done ${money} across ${orders} ${orderWord} in the last ${tiles.window.days} days — ${gmvDelta.label} on the ${tiles.window.days} before.`;

  const lines = [lead];

  // Only worth a sentence when something actually came back.
  if (tiles.return_rate.returned_orders > 0) {
    const rate = formatPercent(tiles.return_rate.value);
    const rateDelta = pointDelta(tiles.return_rate.change_pp);
    lines.push(
      rateDelta.direction === "none" || rateDelta.direction === "flat"
        ? `Return rate is ${rate}, counting refunds and cancellations.`
        : `Return rate is ${rate}, ${rateDelta.label} on the previous period.`,
    );
  }

  if (tiles.mixed_currencies) {
    lines.push(
      `Your channels report in more than one currency — these figures are the ${tiles.currency} side only.`,
    );
  }

  return lines;
}
