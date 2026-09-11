import type { ChannelId } from "@/lib/backend/types";
import type { PnlPage, ChannelPnlRow } from "@/lib/profitability/types";
import type {
  ProductRatingRow,
  RatingImprovement,
  RatingsPage,
  ReviewTopic,
  SellerFeedback,
  SellerRatingPoint,
} from "@/lib/ratings/types";
import type {
  CarrierRow,
  HandlingTimePoint,
  ShippedLateShipment,
  ShippingPage,
} from "@/lib/shipping/types";
import { DEMO_CURRENCY, day, hoursAgo, stamp, world } from "@/lib/dev/demo-seed";
import { sellerCentral } from "@/lib/dev/demo-links";

/**
 * Shipping, Profitability and Ratings.
 *
 * The three tabs whose whole page is one backend read. They live apart from
 * `demo-backend.ts` only because each is a large literal and reads better with
 * its reasoning beside it — the router imports them and nothing else does.
 *
 * They are built from the same catalogue and the same orders as every other
 * tab, so a SKU short on cover in Inventory is the same SKU with a thin margin
 * here, and the late shipments below are the Amazon orders the Orders tab
 * flags. The honesty fields — `fees_available`, `fee_basis`, `coverage`, the
 * gaps — are populated rather than waved through, because they are most of
 * what these screens are for: a demo where every coverage flag is true would
 * hide exactly the states that are hard to get a real backend to produce.
 */

/* --- Profitability ------------------------------------------------------- */

/**
 * Margin per SKU, with the fee basis told honestly.
 *
 * Amazon settles two to four weeks after a sale, so a 30-day window is part
 * settled and part quoted — every Amazon row here is `estimated` with a real
 * split behind it, which is the normal case and the one the tab's wording was
 * written for. Two rows have no fee data at all: one Shopify SKU on an outside
 * gateway, and one Amazon SKU Amazon declined to quote. Their margin is null,
 * never zero — a ₹0 fee would make the SKU nobody understands look like the
 * best margin on the page.
 */
export function profitability(days: number): PnlPage {
  const { products, orders, now } = world();

  const rows: ChannelPnlRow[] = [];
  for (const product of products) {
    for (const channel of product.channels) {
      const sold = orders.filter(
        (order) =>
          order.channel === channel &&
          order.ageHours <= days * 24 &&
          order.skus.includes(product.sku),
      );
      if (!sold.length) continue;

      const units = sold.reduce(
        (sum, order) =>
          sum + (order.lines.find((line) => line.sku === product.sku)?.qty ?? 0),
        0,
      );
      const revenue = sold.reduce(
        (sum, order) =>
          sum + (order.lines.find((line) => line.sku === product.sku)?.line_total ?? 0),
        0,
      );

      // The two rows that cannot be costed, and why.
      const noFees =
        (channel === "shopify" && product.sku === "KHL-THR-004") ||
        (channel === "amazon" && product.sku === "KHL-CER-007");

      const referral = channel === "amazon" ? Math.round(revenue * 0.155) : 0;
      const fba = channel === "amazon" ? Math.round(units * 68) : 0;
      const otherFee = channel === "amazon" ? Math.round(units * 4.5) : 0;
      const shopifyFee = channel === "shopify" ? Math.round(revenue * 0.029) + units * 3 : 0;
      const fees = referral + fba + otherFee + shopifyFee;

      // Amazon's settlement lag, made visible: the older two-thirds of the
      // window is settled, the recent tail is still Amazon's quote.
      const settled = channel === "amazon" ? Math.round(units * 0.66) : units;

      rows.push({
        sku: product.sku,
        title: product.title,
        channel,
        revenue,
        units,
        orders: sold.length,
        currency: DEMO_CURRENCY,
        external_url: sellerCentral.listing(channel, product.sku),
        amazon_referral_fee: noFees ? 0 : referral,
        amazon_fba_fee: noFees ? 0 : fba,
        amazon_other_fee: noFees ? 0 : otherFee,
        shopify_transaction_fee: noFees ? 0 : shopifyFee,
        // "Mostly settled with a quoted tail" is still estimated — calling that
        // actual because most of it is would be the precise failure the tab's
        // own docstring warns about.
        fee_basis: channel === "amazon" ? "estimated" : "actual",
        fees_available: !noFees,
        fee_note: noFees
          ? channel === "shopify"
            ? "This store takes payment through a gateway Shopify does not see, so there is no transaction fee to read."
            : "Amazon has settled nothing on this SKU and declined to quote it, so there is no fee figure."
          : null,
        settled_units: noFees ? 0 : settled,
        estimated_units: noFees ? 0 : units - settled,
        gross_margin_pct: noFees
          ? null
          : Number((((revenue - fees) / revenue) * 100).toFixed(1)),
        buy_box_win_pct: channel === "amazon" ? (noFees ? null : 86.4) : null,
        buy_box_win_pct_prior: channel === "amazon" && !noFees ? 91.2 : null,
        buy_box_prior_date: channel === "amazon" && !noFees ? day(hoursAgo(now, 24 * 9)) : null,
        buy_box_price: channel === "amazon" && !noFees ? Math.round(product.price * 1.08) : null,
        buy_box_is_ours: channel === "amazon" && !noFees ? true : null,
        buy_box_as_of: channel === "amazon" && !noFees ? stamp(hoursAgo(now, 20)) : null,
        current_price:
          channel === "amazon" ? Math.round(product.price * 1.08) : product.price,
      });
    }
  }

  rows.sort((a, b) => b.revenue - a.revenue);

  return {
    days,
    rows,
    coverage: {
      amazon_connected: true,
      shopify_connected: true,
      amazon_skus: rows.filter((row) => row.channel === "amazon").length,
      shopify_skus: rows.filter((row) => row.channel === "shopify").length,
      has_settled_fees: true,
      has_fee_data: true,
      has_buy_box: true,
      shopify_fees_available: true,
      synced_at: stamp(hoursAgo(now, 6)),
      // Both false and expected to stay so: lot-level cost per PO line and a
      // per-SKU shipping cost have no source, and the columns say "coming soon"
      // rather than quietly averaging something.
      cogs_available: false,
      shipping_cost_available: false,
    },
    currency: DEMO_CURRENCY,
  };
}

/* --- Ratings ------------------------------------------------------------- */

/**
 * Seller feedback, review topics and per-product ratings.
 *
 * Amazon-only, and Shopify says why rather than being left out of the page —
 * an absent channel and an unsupported one read differently. The seller rating
 * is the mean of the feedback rows below it and shows its working, because it
 * will not match Seller Central exactly and a tile asserting a number the
 * seller can contradict in another tab is worse than one that explains itself.
 */
export function ratings(): RatingsPage {
  const { now, products, orders } = world();

  const comments: [number, string][] = [
    [1, "Arrived two weeks after the date I was given, with no updates in between."],
    [2, "Packaging was crushed and one of the cups was chipped."],
    [5, "Beautiful pieces, exactly as described. Wrapped really carefully."],
    [4, "Lovely quality. Took a couple of days longer than estimated."],
    [5, "Second time ordering. The indigo throw is even better in person."],
    [3, "Fine, but the colour is a fair bit darker than the photos."],
    [5, "Arrived early and the packaging was all paper — much appreciated."],
    [2, "Ordered two, one turned up. Still waiting to hear back."],
    [4, "Good weight to the brass. A little tarnished on arrival."],
    [5, "Perfect gift. Will order again."],
  ];

  const amazonOrders = orders.filter((order) => order.channel === "amazon").slice(0, 10);

  const feedback: SellerFeedback[] = amazonOrders.map((order, index) => {
    const [rating, comment] = comments[index % comments.length];
    return {
      id: `fb-${order.external_order_id}`,
      channel: "amazon",
      kind: "seller_feedback",
      rating,
      date: day(hoursAgo(now, 24 * (index * 3 + 2))),
      comment,
      order_id: order.external_order_id,
      order_number: order.order_number ?? null,
      // Context, not attribution: an order of three products does not make the
      // complaint about any one of them.
      products: order.skus,
      admin_url: order.external_url,
    };
  });

  const mean = (values: number[]) =>
    values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 0;

  const history: SellerRatingPoint[] = Array.from({ length: 12 }, (_, index) => {
    const back = 11 - index;
    const slice = feedback.slice(Math.max(0, back - 3), back + 3);
    return {
      date: day(hoursAgo(now, 24 * 7 * back)),
      value: slice.length ? mean(slice.map((row) => row.rating)) : 4.2,
      // Genuinely small, and shown rather than hidden — a jagged line should
      // read as thin data, not as a volatile business.
      sample_size: slice.length,
    };
  });

  const amazonProducts = products.filter((product) => product.channels.includes("amazon"));

  const topics: ReviewTopic[] = [
    { sku: "KHL-CHB-002", topic: "Packaging", sentiment: "negative", rank: 1, share: 0.31 },
    { sku: "KHL-CER-008", topic: "Chipping in transit", sentiment: "negative", rank: 2, share: 0.22 },
    { sku: "KHL-THR-003", topic: "Colour accuracy", sentiment: "negative", rank: 3, share: 0.18 },
    { sku: "KHL-CST-001", topic: "Finish quality", sentiment: "positive", rank: 1, share: 0.44 },
    { sku: "KHL-CDL-009", topic: "Scent strength", sentiment: "neutral", rank: 2, share: 0.27 },
    { sku: "KHL-BSK-011", topic: "Sturdiness", sentiment: "positive", rank: 1, share: 0.38 },
  ].map(({ sku, topic, sentiment, rank, share }) => {
    const product = products.find((row) => row.sku === sku)!;
    return {
      sku,
      asin: null,
      title: product.title,
      channel: "amazon" as ChannelId,
      topic,
      sentiment: sentiment as ReviewTopic["sentiment"],
      rank,
      // Amazon's own proportion, never multiplied into a count of reviews:
      // that would read as a number of things somebody could go and look at.
      mention_share: share,
      as_of_date: day(hoursAgo(now, 24 * 4)),
      admin_url: sellerCentral.listing("amazon", sku),
    };
  });

  const productRows: ProductRatingRow[] = amazonProducts.slice(0, 8).map((product, index) => {
    const avg = Number((4.6 - (index % 5) * 0.28).toFixed(2));
    return {
      sku: product.sku,
      asin: null,
      title: product.title,
      channel: "amazon",
      avg_rating: avg,
      // Null on a product with only one stored reading: no history is not the
      // same as no change.
      previous_avg_rating: index === 3 ? null : Number((avg - 0.12 + (index % 3) * 0.1).toFixed(2)),
      period_start: day(hoursAgo(now, 24 * 30)),
      period_end: day(hoursAgo(now, 24)),
      points: 2,
      // Always null: Amazon's trend carries an average and no denominator, and
      // deriving one would put a number on screen that nothing produced.
      review_count: null,
      admin_url: sellerCentral.listing("amazon", product.sku),
    };
  });

  const improvements: RatingImprovement[] = [
    { sku: "KHL-JUT-006", from: 3.9, to: 4.4 },
    { sku: "KHL-APR-013", from: 4.1, to: 4.5 },
  ].map(({ sku, from, to }) => ({
    sku,
    title: products.find((row) => row.sku === sku)!.title,
    channel: "amazon" as ChannelId,
    from,
    to,
    delta: Number((to - from).toFixed(2)),
    period_start: day(hoursAgo(now, 24 * 60)),
    period_end: day(hoursAgo(now, 24)),
    admin_url: sellerCentral.listing("amazon", sku),
  }));

  return {
    connected: true,
    channels: [
      { channel: "amazon", supported: true, reason: null },
      {
        channel: "shopify",
        supported: false,
        reason:
          "Shopify has no seller rating and no review API on this plan, so nothing here covers your store.",
      },
    ],
    gaps: [
      {
        key: "review_text",
        title: "The reviews themselves",
        detail:
          "Amazon gives us topics and averages, not review text. The quotes on this tab are buyer feedback about the transaction, which is a different thing from a product review.",
      },
    ],
    seller_rating: {
      current: mean(feedback.map((row) => row.rating)),
      history,
      // Amazon's own Buy Box eligibility cutoff.
      threshold: 4.5,
      sample_size: feedback.length,
      window_days: 90,
      basis: "feedback_average",
    },
    feedback,
    topics,
    // The negative slice, worst-ranked first.
    concerns: topics
      .filter((topic) => topic.sentiment === "negative")
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
    products: productRows,
    improvements,
    seller_central: sellerCentral.tab("ratings"),
    synced_at: stamp(hoursAgo(now, 9)),
    never_synced: false,
  };
}

/* --- Shipping ------------------------------------------------------------ */

/**
 * Fulfilment health over a window.
 *
 * Handling time is seller-fulfilled only — Amazon picks and packs its own, and
 * averaging its speed in would credit the seller for something they did not
 * do. The Late Shipment Rate is not recomputed here either: it is the same
 * 4.6% the Account Health tab reads, because a tab deriving its own would
 * eventually disagree with Seller Central about the number the account is
 * actually judged on.
 */
export function shipping(days: number): ShippingPage {
  const { now, orders } = world();

  const sellerFulfilled = orders.filter(
    (order) => order.ageHours <= days * 24 && !order.fba,
  );
  const amazonFulfilled = orders.filter(
    (order) => order.ageHours <= days * 24 && order.fba,
  );
  const packages = sellerFulfilled.length + amazonFulfilled.length;

  // A 3PL switch three weeks ago: a flat baseline, a spike, then a recovery
  // that has not got back to where it started.
  const baseline = [14, 13, 15, 14, 13, 15, 14, 13, 14, 15, 14, 13, 15, 14];
  const afterSwitch = [24, 31, 29, 29, 27, 26, 25, 24, 23, 22, 22, 21, 22, 21, 20, 21];
  const series = [...baseline, ...afterSwitch].slice(-Math.min(days, 30));

  const handling: HandlingTimePoint[] = series.map((avgHours, index) => ({
    date: day(hoursAgo(now, 24 * (series.length - index))),
    avg_hours: avgHours,
    shipments: 3 + ((index * 7) % 9),
  }));

  const carriers: CarrierRow[] = [
    {
      carrier: "Delhivery",
      channel: "shopify",
      fba: false,
      shipments: Math.round(packages * 0.34),
      on_time_pct: 81,
      deliveries_measured: Math.round(packages * 0.3),
      avg_transit_days: 3.2,
      exceptions: { lost: 1, returned: 3, exception: 4 },
      thin: false,
    },
    {
      carrier: "Blue Dart",
      channel: "shopify",
      fba: false,
      shipments: Math.round(packages * 0.21),
      on_time_pct: 94,
      deliveries_measured: Math.round(packages * 0.19),
      avg_transit_days: 2.1,
      exceptions: { lost: 0, returned: 1, exception: 1 },
      thin: false,
    },
    {
      carrier: "Amazon Shipping",
      channel: "amazon",
      fba: true,
      shipments: amazonFulfilled.length,
      on_time_pct: 96,
      deliveries_measured: Math.round(amazonFulfilled.length * 0.88),
      avg_transit_days: 1.9,
      exceptions: { lost: 0, returned: 2, exception: 1 },
      thin: false,
    },
    {
      // Too few parcels for the percentages to describe the carrier rather
      // than the sample. The row stays: the shipment count is still worth
      // seeing, and hiding it would hide a carrier being trialled.
      carrier: "India Post",
      channel: "shopify",
      fba: false,
      shipments: 4,
      on_time_pct: null,
      deliveries_measured: 0,
      avg_transit_days: null,
      exceptions: { lost: 0, returned: 0, exception: 1 },
      thin: true,
    },
  ];

  // Amazon, merchant-fulfilled only. FBA cannot count against the seller, and
  // Shopify makes no dispatch promise to be late against.
  const scopeOrders = orders.filter((order) => order.channel === "amazon" && !order.fba);

  const atRisk = scopeOrders
    .filter((order) => order.flags.includes("stuck"))
    .sort((a, b) => b.ageHours - a.ageHours)
    .slice(0, 6)
    .map((order) => ({
      external_order_id: order.external_order_id,
      order_number: order.order_number ?? null,
      channel: "amazon" as ChannelId,
      promised_ship_by: stamp(hoursAgo(now, order.ageHours - 48)),
      order_date: order.order_date ?? null,
      carrier: null,
      days_late: null,
    }));

  const shippedLate: ShippedLateShipment[] = scopeOrders
    .filter((order) => !order.flags.length && order.ageHours > 24 * 5)
    .slice(0, 5)
    .map((order, index) => ({
      external_order_id: order.external_order_id,
      order_number: order.order_number ?? null,
      channel: "amazon",
      carrier: index % 2 ? "Blue Dart" : "Delhivery",
      promised_ship_by: stamp(hoursAgo(now, order.ageHours - 48)),
      ship_date: stamp(hoursAgo(now, order.ageHours - 48 - 24 * (index + 1))),
      days_late: index + 1,
    }));

  const metric = (value: number | null, previous: number | null, measured: number) => ({
    value,
    previous,
    measured,
    total: packages,
  });

  return {
    days,
    summary: {
      avg_handling_hours: metric(21, 28, sellerFulfilled.length),
      on_time_dispatch_pct: metric(91, 95, Math.round(packages * 0.42)),
      on_time_delivery_pct: metric(88, 92, Math.round(packages * 0.71)),
      late_shipment_rate_pct: {
        // The same figure Account Health shows. Deliberately not recomputed.
        value: 4.6,
        previous: 3.9,
        measured: null,
        total: null,
        as_of: day(hoursAgo(now, 24)),
        source: "amazon_account_health",
      },
      threshold: 4,
      packages,
    },
    handling_time_trend: handling,
    carriers,
    late_shipments: { at_risk: atRisk, shipped_late: shippedLate, scope: "amazon_merchant_fulfilled" },
    coverage: {
      amazon_connected: true,
      shopify_connected: true,
      packages,
      seller_fulfilled: sellerFulfilled.length,
      amazon_fulfilled: amazonFulfilled.length,
      shopify_packages: orders.filter(
        (order) => order.channel === "shopify" && order.ageHours <= days * 24,
      ).length,
      has_fba_shipments: true,
      has_deliveries: true,
      synced_at: stamp(hoursAgo(now, 5)),
    },
  };
}
