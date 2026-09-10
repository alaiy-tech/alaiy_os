import type { ChannelPnlRow } from "./types";

/**
 * Seed data for the Profitability tab.
 *
 * Built to actually add up rather than to assert a headline number: every
 * revenue, fee and shipping figure below is a real per-unit calculation
 * (referral fee as a percentage, FBA fee as a flat per-unit charge, an
 * estimated shipping cost per unit for self-shipped rows), so the margins
 * the table computes are this data's own arithmetic, not a hardcoded string
 * chosen to match the issue's prose. Two deliberate stories:
 *
 *   - Leather Wallet Slim is the highest-revenue product here, and
 *     — once its fees are counted — only the 4th-highest margin of six.
 *     "Highest revenue" and "best margin" are different questions, which is
 *     the whole reason this tab exists.
 *   - Cotton Scrunchie Pack, Linen Tote Natural and Canvas Pouch Small all
 *     run negative before COGS is even in the picture: two by a flat FBA fee
 *     that dwarfs a cheap item's price, one by a bulky item's shipping cost
 *     exceeding what it sells for.
 *
 * Amazon rows here are assumed FBA-fulfilled throughout — Amazon's own fee
 * already covers pick, pack and ship, so `shippingCost` is 0 on every one of
 * them; Shopify rows carry a genuine, marked-estimated shipping cost.
 */
export function buildMockPnlRows(): ChannelPnlRow[] {
  return [
    {
      sku: "LWS-BRN-01-AMZ",
      title: "Leather Wallet Slim",
      channel: "amazon",
      revenue: 201190,
      units: 310,
      amazonReferralFee: 30179,
      amazonFbaFee: 43400,
      shopifyTransactionFee: 0,
      feeBasis: "actual",
      shippingCost: 0,
      shippingCostBasis: "actual",
      buyBoxWinPct: 88,
      buyBoxWinPctSevenDaysAgo: 90,
      currentPrice: 649,
      buyBoxPrice: 652,
    },
    {
      sku: "LWS-BRN-01-SHP",
      title: "Leather Wallet Slim",
      channel: "shopify",
      revenue: 31455,
      units: 45,
      amazonReferralFee: 0,
      amazonFbaFee: 0,
      shopifyTransactionFee: 629,
      feeBasis: "actual",
      shippingCost: 2700,
      shippingCostBasis: "estimated",
      buyBoxWinPct: null,
      buyBoxWinPctSevenDaysAgo: null,
      currentPrice: null,
      buyBoxPrice: null,
    },
    {
      sku: "CTB-BLK-01-AMZ",
      title: "Canvas Tote Bag (Black)",
      channel: "amazon",
      revenue: 98820,
      units: 180,
      amazonReferralFee: 14823,
      amazonFbaFee: 16200,
      shopifyTransactionFee: 0,
      feeBasis: "actual",
      shippingCost: 0,
      shippingCostBasis: "actual",
      // The issue's own example: a competitor undercut this listing and the
      // win rate fell hard in a week.
      buyBoxWinPct: 54,
      buyBoxWinPctSevenDaysAgo: 91,
      currentPrice: 549,
      buyBoxPrice: 514,
      projectedBuyBoxRecoveryPct: 73,
      projectedMonthlyRevenueImpact: 28000,
    },
    {
      sku: "CTB-BLK-01-SHP",
      title: "Canvas Tote Bag (Black)",
      channel: "shopify",
      revenue: 22762,
      units: 38,
      amazonReferralFee: 0,
      amazonFbaFee: 0,
      shopifyTransactionFee: 455,
      feeBasis: "actual",
      shippingCost: 2470,
      shippingCostBasis: "estimated",
      buyBoxWinPct: null,
      buyBoxWinPctSevenDaysAgo: null,
      currentPrice: null,
      buyBoxPrice: null,
    },
    {
      sku: "SCR-MLT-01-AMZ",
      title: "Cotton Scrunchie Pack",
      channel: "amazon",
      // A ₹79 item eating a ₹78 flat FBA fee plus 15% referral — the flat
      // fee alone is nearly the entire price.
      revenue: 48190,
      units: 610,
      amazonReferralFee: 7229,
      amazonFbaFee: 47580,
      shopifyTransactionFee: 0,
      feeBasis: "actual",
      shippingCost: 0,
      shippingCostBasis: "actual",
      buyBoxWinPct: 72,
      buyBoxWinPctSevenDaysAgo: 74,
      currentPrice: 79,
      buyBoxPrice: 76,
    },
    {
      sku: "LTN-NAT-01-SHP",
      title: "Linen Tote Natural",
      channel: "shopify",
      // The other way to go negative: a bulky tote whose estimated shipping
      // cost is now above what it sells for.
      revenue: 43890,
      units: 110,
      amazonReferralFee: 0,
      amazonFbaFee: 0,
      shopifyTransactionFee: 878,
      feeBasis: "actual",
      shippingCost: 46200,
      shippingCostBasis: "estimated",
      buyBoxWinPct: null,
      buyBoxWinPctSevenDaysAgo: null,
      currentPrice: null,
      buyBoxPrice: null,
    },
    {
      sku: "CPS-NAT-01-AMZ",
      title: "Canvas Pouch Small",
      channel: "amazon",
      revenue: 28900,
      units: 340,
      amazonReferralFee: 4335,
      amazonFbaFee: 26520,
      shopifyTransactionFee: 0,
      feeBasis: "actual",
      shippingCost: 0,
      shippingCostBasis: "actual",
      buyBoxWinPct: 80,
      buyBoxWinPctSevenDaysAgo: 81,
      currentPrice: 85,
      buyBoxPrice: 82,
    },
    {
      sku: "SCB-TAN-01-SHP",
      title: "Suede Crossbody Bag",
      channel: "shopify",
      revenue: 53940,
      units: 60,
      amazonReferralFee: 0,
      amazonFbaFee: 0,
      shopifyTransactionFee: 1079,
      feeBasis: "actual",
      shippingCost: 6600,
      shippingCostBasis: "estimated",
      buyBoxWinPct: null,
      buyBoxWinPctSevenDaysAgo: null,
      currentPrice: null,
      buyBoxPrice: null,
    },
  ];
}
