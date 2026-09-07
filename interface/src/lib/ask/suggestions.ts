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
  "/orders": [
    "Which orders are still unfulfilled?",
    "What's my average order value this month?",
    "Show refunded orders from the last 30 days",
    "Which channel is growing fastest?",
  ],
  "/inventory": [
    "Which SKUs are out of stock?",
    "What has less than 7 days of cover?",
    "Show my highest-value stock on hand",
    "Which listings are inactive?",
  ],
  "/finance": [
    "What's unsettled right now?",
    "Any payout mismatches this month?",
    "Break down fees by channel",
    "When is my next Amazon settlement due?",
  ],
  "/channels": [
    "Which channel is growing fastest?",
    "Is anything failing to sync?",
    "Compare Shopify and Amazon this month",
  ],
};

const FALLBACK = BY_ROUTE["/home"];

export function suggestionsFor(pathname: string): string[] {
  return BY_ROUTE[pathname] ?? FALLBACK;
}
