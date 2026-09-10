/**
 * Context-aware suggestions for Ask Alaiy.
 *
 * Keyed by route, so the docked panel offers what is relevant to the screen
 * behind it and Home's centred prompt offers the general set. Finance is
 * listed before it exists on purpose: the map is what makes the panel
 * context-aware the moment a tab lands, rather than a later edit here.
 */

const BY_ROUTE: Record<string, string[]> = {
  "/home": [
    "How did last week compare with the week before?",
    "Which SKUs drove the most revenue?",
    "What's running low on stock?",
    "Show me orders by channel",
  ],
  // The glance tab, so these are the questions a figure provokes rather than
  // the general set: a seller is here because a tile moved.
  "/dashboard": [
    "Why is my return rate up this week?",
    "Which SKUs drove today's sales?",
    "What's still unshipped from this week?",
    "How does today compare with last Monday?",
  ],
  "/orders": [
    "Which orders are still unfulfilled?",
    "What's my average order value this month?",
    "Show refunded orders from the last 30 days",
    "Which channel is growing fastest?",
  ],
  "/listings": [
    "Which listings are suppressed on Amazon?",
    "Which products are missing bullet points?",
    "What's not linked between Shopify and Amazon?",
    "Suggest keywords for my canvas tote listing",
  ],
  "/inventory": [
    "Which SKUs are out of stock?",
    "What has less than 7 days of cover?",
    "Which POs land after I run out?",
    "Show my highest-value stock on hand",
    "Which listings are inactive?",
  ],
  "/finance": [
    "What's unsettled right now?",
    "Any payout mismatches this month?",
    "Break down fees by channel",
    "When is my next Amazon settlement due?",
  ],
  // The projection question the spec puts in Alaiy's mouth is first, because
  // it is the one thing here a seller cannot read off the tiles themselves.
  "/account-health": [
    "If my 2 unshipped orders go out late, where does my LSR land?",
    "Which SKUs are getting the worst feedback?",
    "How close am I to Amazon's ODR limit?",
    "What changed in my account health this month?",
  ],
  "/channels": [
    "Which channel is growing fastest?",
    "Is anything failing to sync?",
    "Compare Shopify and Amazon this month",
  ],
  "/ratings": [
    "Explain the rating change on Canvas Tote Bag",
    "Is my Amazon rating trending toward the Buy Box risk?",
    "Which SKU has the most 1-star reviews this month?",
  ],
  "/shipping": [
    "Why did handling time spike last week?",
    "Which carrier is underperforming right now?",
    "Which orders need to ship today to protect my Late Shipment Rate?",
  ],
  "/profitability": [
    "Which SKUs are losing money after fees?",
    "Explain the margin on my highest-revenue product",
    "Which listings are losing the Buy Box right now?",
  ],
};

const FALLBACK = BY_ROUTE["/home"];

export function suggestionsFor(pathname: string): string[] {
  return BY_ROUTE[pathname] ?? FALLBACK;
}
