import type {
  ChannelId,
  ChannelOrder,
  ChannelOrderItem,
  ChannelProduct,
  ConnectorStatus,
  OrderFlagKey,
} from "@/lib/backend/types";
import type { Listing } from "@/lib/listings/types";
import type { PurchaseOrder, StockRow } from "@/lib/inventory/types";

/**
 * The seller demo mode invents: a home-and-kitchen brand on Shopify and Amazon
 * India, forty-five days in.
 *
 * Everything the demo backend answers is derived from the catalogue below —
 * listings, orders, stock cover, the Dashboard tiles and the alerts are all
 * readings of the same fourteen products, so the numbers agree across tabs the
 * way real ones would. A tile that said 214 orders over a table showing 60
 * would be worse than no demo mode at all: it would teach you to distrust the
 * screen you are trying to check.
 *
 * ## Everything here is deterministic
 *
 * A seeded PRNG, not `Math.random`. A page re-rendered on every keystroke in
 * the filter bar has to show the same rows it showed a moment ago, or the tab
 * is unusable for looking at — and a screenshot taken twice has to match.
 * `now` is captured once per server process for the same reason.
 */

/* --- deterministic randomness ------------------------------------------ */

/** mulberry32: small, fast, and the same sequence from the same seed forever. */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];

const between = (random: () => number, min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));

/* --- dates -------------------------------------------------------------- */

/** "YYYY-MM-DD HH:MM:SS" in local time — the naive stamp Frappe sends. */
export function stamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ` +
    `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
  );
}

export function day(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export const hoursAgo = (now: Date, n: number) =>
  new Date(now.getTime() - n * 3_600_000);

/* --- the catalogue ------------------------------------------------------ */

type SeedProduct = {
  sku: string;
  title: string;
  category: string;
  /** INR, on Shopify. Amazon's offer is priced a little differently below. */
  price: number;
  channels: ChannelId[];
  /** Units a day, which is what days-of-cover is computed from. */
  perDay: number;
  warehouseQty: number;
  shopifyQty: number | null;
  fbaQty: number | null;
  /** Placeholder thumbnail hue, so a table of rows is not fourteen grey boxes. */
  hue: number;
  /** Set on the one listing Amazon has suppressed, to exercise that state. */
  suppressed?: { reason: string; code: string };
  /** Set where Shopify's DRAFT / Amazon's inactive state is worth seeing. */
  inactiveOn?: ChannelId;
};

const CATALOGUE: SeedProduct[] = [
  { sku: "KHL-CST-001", title: "Marble Coaster Set of 4", category: "Tableware", price: 1290, channels: ["shopify", "amazon"], perDay: 6.2, warehouseQty: 180, shopifyQty: 64, fbaQty: 96, hue: 18 },
  { sku: "KHL-CHB-002", title: "Terracotta Chai Cups, Set of 6", category: "Tableware", price: 890, channels: ["shopify", "amazon"], perDay: 9.4, warehouseQty: 42, shopifyQty: 18, fbaQty: 12, hue: 24 },
  { sku: "KHL-THR-003", title: "Handloom Cotton Throw — Indigo", category: "Soft Furnishing", price: 2450, channels: ["shopify", "amazon"], perDay: 2.1, warehouseQty: 96, shopifyQty: 40, fbaQty: 31, hue: 215 },
  { sku: "KHL-THR-004", title: "Handloom Cotton Throw — Ochre", category: "Soft Furnishing", price: 2450, channels: ["shopify"], perDay: 1.4, warehouseQty: 74, shopifyQty: 74, fbaQty: null, hue: 40 },
  { sku: "KHL-BRS-005", title: "Brass Diya, Pair", category: "Decor", price: 1650, channels: ["shopify", "amazon"], perDay: 3.8, warehouseQty: 12, shopifyQty: 4, fbaQty: 6, hue: 46 },
  { sku: "KHL-JUT-006", title: "Jute Table Runner, 180cm", category: "Tableware", price: 1190, channels: ["shopify", "amazon"], perDay: 2.6, warehouseQty: 210, shopifyQty: 88, fbaQty: 120, hue: 33 },
  { sku: "KHL-CER-007", title: "Stoneware Serving Bowl — Slate", category: "Tableware", price: 1790, channels: ["amazon"], perDay: 1.9, warehouseQty: 58, shopifyQty: null, fbaQty: 58, hue: 205, suppressed: { reason: "Amazon needs a compliance document for this listing before it can go live again.", code: "MISSING_SAFETY_DOC" } },
  { sku: "KHL-CER-008", title: "Stoneware Dinner Plate — Slate", category: "Tableware", price: 1490, channels: ["shopify", "amazon"], perDay: 4.4, warehouseQty: 132, shopifyQty: 52, fbaQty: 74, hue: 200 },
  { sku: "KHL-CDL-009", title: "Soy Candle — Sandalwood, 200g", category: "Decor", price: 990, channels: ["shopify", "amazon"], perDay: 7.1, warehouseQty: 24, shopifyQty: 9, fbaQty: 14, hue: 300 },
  { sku: "KHL-CDL-010", title: "Soy Candle — Vetiver, 200g", category: "Decor", price: 990, channels: ["shopify"], perDay: 3.3, warehouseQty: 148, shopifyQty: 148, fbaQty: null, hue: 140, inactiveOn: "shopify" },
  { sku: "KHL-BSK-011", title: "Seagrass Storage Basket, Large", category: "Storage", price: 2190, channels: ["shopify", "amazon"], perDay: 1.6, warehouseQty: 66, shopifyQty: 28, fbaQty: 34, hue: 62 },
  { sku: "KHL-BSK-012", title: "Seagrass Storage Basket, Small", category: "Storage", price: 1390, channels: ["shopify", "amazon"], perDay: 2.9, warehouseQty: 0, shopifyQty: 0, fbaQty: 3, hue: 70 },
  { sku: "KHL-APR-013", title: "Block-Print Cotton Apron", category: "Kitchen Linen", price: 1090, channels: ["shopify", "amazon"], perDay: 2.2, warehouseQty: 190, shopifyQty: 72, fbaQty: 104, hue: 350 },
  { sku: "KHL-NPK-014", title: "Block-Print Napkins, Set of 6", category: "Kitchen Linen", price: 1490, channels: ["shopify", "amazon"], perDay: 1.8, warehouseQty: 88, shopifyQty: 36, fbaQty: 44, hue: 330 },
];

/**
 * A thumbnail with no network behind it.
 *
 * An inline SVG rather than a URL to a stock-photo host: demo mode has to work
 * on a plane, and a table of fourteen broken-image glyphs would be a worse
 * rendering of the layout than no images at all.
 */
function thumbnail(product: SeedProduct): string {
  const initials = product.title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">` +
    `<rect width="160" height="160" fill="hsl(${product.hue} 38% 86%)"/>` +
    `<text x="80" y="94" font-family="Georgia,serif" font-size="52" fill="hsl(${product.hue} 45% 30%)" text-anchor="middle">${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SHOP_DOMAIN = "kavya-home-living.myshopify.com";

/** Amazon prices a little above Shopify here, which is what makes the two rows
 *  worth showing side by side rather than collapsing into one. */
const amazonPrice = (product: SeedProduct) => Math.round(product.price * 1.08);

const asin = (index: number) => `B0${String(91_244_300 + index * 617)}`;

/* --- the world ---------------------------------------------------------- */

const CUSTOMERS = [
  "Aditi Sharma", "Rohan Mehta", "Priya Nair", "Vikram Iyer", "Sneha Kulkarni",
  "Arjun Desai", "Meera Pillai", "Karan Joshi", "Ananya Bose", "Rahul Verma",
  "Ishita Rao", "Nikhil Chatterjee", "Divya Menon", "Sameer Khan", "Tara Gupta",
  "Harsh Agarwal", "Lakshmi Reddy", "Imran Sheikh", "Nisha Bhatt", "Yash Patel",
];

/** Loudest first, matching SEVERITY in the backend's order_flags.py. */
const SEVERITY: Record<OrderFlagKey, number> = {
  unfulfillable: 5,
  payment_pending: 4,
  stuck: 3,
  refunded: 2,
  cancelled: 1,
};

export const DEMO_RULES = {
  pending_payment_hours: 48,
  unshipped_hours: 48,
  fba_unshipped_hours: 72,
};

export const DEMO_CURRENCY = "INR";

/** Days of history the demo seller has. */
const HISTORY_DAYS = 45;

export type DemoOrder = ChannelOrder & {
  lines: ChannelOrderItem[];
  destination: string;
  /** FBA or the seller's own, which is what the fulfilment filter cuts on. */
  fba: boolean;
  /** Hours before `now`, kept so the order's age is comparable without parsing. */
  ageHours: number;
};

export type DemoWorld = {
  now: Date;
  products: SeedProduct[];
  listings: Listing[];
  orders: DemoOrder[];
  channelProducts: ChannelProduct[];
  stockRows: StockRow[];
  purchaseOrders: PurchaseOrder[];
  connectors: ConnectorStatus[];
};

function buildListings(now: Date): Listing[] {
  const listings: Listing[] = [];
  CATALOGUE.forEach((product, index) => {
    for (const channel of product.channels) {
      const suppressed = channel === "amazon" && product.suppressed;
      const inactive = product.inactiveOn === channel;
      const externalId =
        channel === "amazon" ? asin(index) : String(7_412_000_000 + index * 331);

      listings.push({
        id: `${channel}-${product.sku}`,
        channel,
        external_id: externalId,
        sku: product.sku,
        title: product.title,
        description:
          `${product.title}. Made in small batches by our partner workshop in Jaipur. ` +
          `Sold as listed; dimensions and care instructions are on the product page.`,
        status: suppressed
          ? "SUPPRESSED"
          : inactive
            ? channel === "shopify"
              ? "DRAFT"
              : "INACTIVE"
            : channel === "shopify"
              ? "ACTIVE"
              : "ACTIVE",
        active: !suppressed && !inactive,
        price: channel === "amazon" ? amazonPrice(product) : product.price,
        currency: DEMO_CURRENCY,
        images: [thumbnail(product)],
        image_url: thumbnail(product),
        bullets:
          channel === "amazon"
            ? [
                "Hand-finished by artisans in Jaipur",
                "Food-safe and dishwasher friendly",
                "Ships in recyclable packaging",
              ]
            : null,
        category: product.category,
        barcode: `89${String(10_000_000_000 + index * 7919)}`,
        // A listing missing its bullets, its barcode or an image scores lower;
        // the suppressed one scores lowest, which is what the band reflects.
        health_score: suppressed ? 41 : inactive ? 68 : channel === "amazon" ? 92 : 86,
        health: suppressed ? "suppressed" : inactive ? "warning" : "live",
        suppression_reason: suppressed ? product.suppressed!.reason : null,
        suppression_code: suppressed ? product.suppressed!.code : null,
        suppressed_since: suppressed ? day(hoursAgo(now, 96)) : null,
        storefront_url:
          channel === "amazon"
            ? `https://www.amazon.in/dp/${externalId}`
            : `https://${SHOP_DOMAIN}/products/${product.sku.toLowerCase()}`,
        admin_url:
          channel === "amazon"
            ? `https://sellercentral.amazon.in/inventory/ref=xx_invmgr?sku=${product.sku}`
            : `https://${SHOP_DOMAIN}/admin/products/${externalId}`,
        last_synced_at: stamp(hoursAgo(now, channel === "amazon" ? 5 : 1)),
      });
    }
  });
  return listings;
}

function buildChannelProducts(now: Date): ChannelProduct[] {
  const rows: ChannelProduct[] = [];
  CATALOGUE.forEach((product, index) => {
    for (const channel of product.channels) {
      const suppressed = channel === "amazon" && product.suppressed;
      const inactive = product.inactiveOn === channel;
      rows.push({
        name: `${channel}-${product.sku}`,
        channel,
        sku: product.sku,
        title: product.title,
        status: suppressed
          ? "SUPPRESSED"
          : inactive
            ? channel === "shopify"
              ? "DRAFT"
              : "INACTIVE"
            : "ACTIVE",
        price: channel === "amazon" ? amazonPrice(product) : product.price,
        currency: DEMO_CURRENCY,
        available_qty:
          channel === "amazon" ? (product.fbaQty ?? 0) : (product.shopifyQty ?? 0),
        external_product_id:
          channel === "amazon" ? asin(index) : String(7_412_000_000 + index * 331),
        external_url:
          channel === "amazon"
            ? `https://www.amazon.in/dp/${asin(index)}`
            : `https://${SHOP_DOMAIN}/products/${product.sku.toLowerCase()}`,
        image_url: thumbnail(product),
        inventory_updated_at: stamp(hoursAgo(now, channel === "amazon" ? 5 : 1)),
        last_synced_at: stamp(hoursAgo(now, channel === "amazon" ? 5 : 1)),
      });
    }
  });
  return rows;
}

const THRESHOLDS = { critical: 7, low: 14, watch: 30 };

function band(cover: number | null): StockRow["band"] {
  if (cover === null) return "unknown";
  if (cover <= THRESHOLDS.critical) return "critical";
  if (cover <= THRESHOLDS.low) return "low";
  if (cover <= THRESHOLDS.watch) return "watch";
  return "healthy";
}

function buildStock(now: Date, velocityDays: number): StockRow[] {
  const rows: StockRow[] = [];
  CATALOGUE.forEach((product) => {
    for (const channel of product.channels) {
      const channelQty =
        channel === "amazon" ? (product.fbaQty ?? 0) : (product.shopifyQty ?? 0);
      const total = product.warehouseQty + channelQty;
      // Velocity is per channel, and Amazon carries rather more of it here.
      const share = channel === "amazon" ? 0.58 : 0.42;
      // The window is not a label on the same number. A 7-day average is the
      // last week's demand, which is running ahead of the 30-day one — so the
      // toggle changes the rate, and with it the cover and the band, which is
      // the whole reason the tab offers it.
      const windowFactor = velocityDays <= 7 ? 1.18 : velocityDays >= 30 ? 0.84 : 1;
      const sellThrough = Number((product.perDay * share * windowFactor).toFixed(2));
      const cover = sellThrough > 0 ? Math.round(total / sellThrough) : null;
      const incoming = product.warehouseQty < 60 ? between(prng(product.sku.length * 97), 60, 240) : 0;

      rows.push({
        row_id: `${channel}-${product.sku}`,
        channel,
        name: product.title,
        brand_sku: product.sku,
        warehouse_qty: product.warehouseQty,
        shopify_qty: channel === "shopify" ? product.shopifyQty : null,
        amazon_fba_qty: channel === "amazon" ? product.fbaQty : null,
        total_available: total,
        sell_through: sellThrough,
        velocity_days: velocityDays,
        days_of_cover: cover,
        band: band(cover),
        incoming_units: incoming,
        next_arrival: incoming ? day(hoursAgo(now, -24 * 9)) : null,
        source: "erp",
        // One oversell risk, so the discrepancy chip has something to render.
        discrepancy:
          product.sku === "KHL-CHB-002" && channel === "shopify"
            ? { units: 14, pct: 33 }
            : null,
        cogs: null,
      });
    }
  });
  return rows;
}

function buildPurchaseOrders(now: Date): PurchaseOrder[] {
  return [
    {
      po_number: "PO-2419",
      supplier: "Jaipur Blue Pottery Works",
      skus: ["KHL-CER-007", "KHL-CER-008"],
      units: 240,
      expected_arrival: day(hoursAgo(now, -24 * 9)),
      status: "in_transit",
      lowest_cover: 11,
    },
    {
      po_number: "PO-2423",
      supplier: "Anand Brassware",
      skus: ["KHL-BRS-005"],
      units: 120,
      expected_arrival: day(hoursAgo(now, -24 * 4)),
      status: "in_transit",
      lowest_cover: 4,
    },
    {
      po_number: "PO-2431",
      supplier: "Kutch Handloom Collective",
      skus: ["KHL-THR-003", "KHL-THR-004", "KHL-APR-013"],
      units: 300,
      expected_arrival: day(hoursAgo(now, -24 * 21)),
      status: "open",
      lowest_cover: 36,
    },
    {
      po_number: "PO-2408",
      supplier: "Seagrass Weavers Co-op",
      skus: ["KHL-BSK-011", "KHL-BSK-012"],
      units: 160,
      // Overdue: the arrival is behind us and KHL-BSK-012 is already at zero.
      expected_arrival: day(hoursAgo(now, 24 * 3)),
      status: "open",
      lowest_cover: 0,
    },
  ];
}

/**
 * Forty-five days of orders, weighted so the recent ones are what you see.
 *
 * The problem orders are placed deliberately rather than left to the dice: one
 * Amazon order Amazon itself cannot fulfil, a handful sitting unpaid past the
 * workspace's own threshold, a cluster unshipped past theirs, some refunds and
 * some cancellations. Those five are the whole vocabulary of the Orders tab,
 * and every one of them has to be on screen or the filter bar cannot be tried.
 */
function buildOrders(now: Date): DemoOrder[] {
  const random = prng(20260911);
  const orders: DemoOrder[] = [];

  for (let index = 0; index < 214; index += 1) {
    // Skewed towards today: squaring a uniform draw puts roughly half the
    // orders in the last quarter of the window, which is what a growing
    // seller's table actually looks like.
    const ageHours = Math.round(Math.pow(random(), 2) * HISTORY_DAYS * 24);
    const placed = hoursAgo(now, ageHours);
    const channel: ChannelId = random() < 0.55 ? "shopify" : "amazon";
    const fba = channel === "amazon" && random() < 0.7;

    const lineCount = random() < 0.62 ? 1 : random() < 0.85 ? 2 : 3;
    const chosen: SeedProduct[] = [];
    while (chosen.length < lineCount) {
      const candidate = pick(random, CATALOGUE);
      if (!candidate.channels.includes(channel)) continue;
      if (chosen.some((p) => p.sku === candidate.sku)) continue;
      chosen.push(candidate);
    }

    const orderNumber =
      channel === "shopify"
        ? `#${1001 + index}`
        : `40${String(3 + (index % 7))}-${String(1_000_000 + index * 137).slice(0, 7)}-${String(2_000_000 + index * 71).slice(0, 7)}`;

    const lines: ChannelOrderItem[] = chosen.map((product, line) => {
      const qty = random() < 0.78 ? 1 : between(random, 2, 4);
      const unitPrice = channel === "amazon" ? amazonPrice(product) : product.price;
      const lineTotal = unitPrice * qty;
      return {
        name: `${channel}-${index}-${line}`,
        channel,
        external_order_id: `${channel}-${index}`,
        order_number: orderNumber,
        order_date: stamp(placed),
        sku: product.sku,
        external_line_id: `${index}-${line}`,
        product_title: product.title,
        qty,
        unit_price: unitPrice,
        line_total: lineTotal,
        tax_amount: Math.round(lineTotal * 0.18),
        discount_amount: 0,
        currency: DEMO_CURRENCY,
        last_synced_at: stamp(hoursAgo(now, channel === "amazon" ? 5 : 1)),
      };
    });

    const merchandise = lines.reduce((sum, line) => sum + (line.line_total ?? 0), 0);
    const tax = lines.reduce((sum, line) => sum + (line.tax_amount ?? 0), 0);
    const shipping = merchandise >= 1500 ? 0 : 79;

    // What state this order is in. The dice decide, but the thresholds below
    // are the workspace's own — so a "not shipped" flag here means the same
    // thing the tab's tooltip says it means.
    const roll = random();
    let financial = "paid";
    let fulfillment = channel === "amazon" ? (fba ? "AFN" : "MFN") : "fulfilled";
    let status = "completed";
    const flags: OrderFlagKey[] = [];

    if (roll < 0.04) {
      financial = "refunded";
      status = "refunded";
      flags.push("refunded");
    } else if (roll < 0.07) {
      financial = "voided";
      status = "cancelled";
      fulfillment = channel === "amazon" ? "Canceled" : "unfulfilled";
      flags.push("cancelled");
    } else if (roll < 0.12) {
      financial = "pending";
      status = "pending";
      fulfillment = channel === "amazon" ? "MFN" : "unfulfilled";
      if (ageHours > DEMO_RULES.pending_payment_hours) flags.push("payment_pending");
    } else if (roll < 0.28) {
      fulfillment = channel === "amazon" ? (fba ? "AFN" : "MFN") : "unfulfilled";
      status = "processing";
      const threshold = fba ? DEMO_RULES.fba_unshipped_hours : DEMO_RULES.unshipped_hours;
      if (ageHours > threshold) flags.push("stuck");
    } else if (roll < 0.30 && channel === "amazon") {
      status = "Unfulfillable";
      fulfillment = "AFN";
      flags.push("unfulfillable");
    }

    const severity = flags.reduce((worst, flag) => Math.max(worst, SEVERITY[flag]), 0);

    orders.push({
      channel,
      external_order_id: `${channel}-${index}`,
      order_number: orderNumber,
      order_date: stamp(placed),
      order_status: status,
      financial_status: financial,
      fulfillment_status: fulfillment,
      customer_name: pick(random, CUSTOMERS),
      currency: DEMO_CURRENCY,
      order_total: merchandise + tax + shipping,
      merchandise_total: merchandise,
      units: lines.reduce((sum, line) => sum + (line.qty ?? 0), 0),
      line_count: lines.length,
      skus: lines.map((line) => line.sku!).filter(Boolean),
      last_synced_at: stamp(hoursAgo(now, channel === "amazon" ? 5 : 1)),
      flags,
      severity,
      needs_attention: flags.some((flag) => SEVERITY[flag] >= SEVERITY.stuck),
      external_url:
        channel === "amazon"
          ? `https://sellercentral.amazon.in/orders-v3/order/${orderNumber}`
          : `https://${SHOP_DOMAIN}/admin/orders/${5_500_000 + index}`,
      lines,
      destination: channel === "amazon" ? "Seller Central" : "Shopify admin",
      fba,
      ageHours,
    });
  }

  // Newest first is the honest default for a table of orders; the tab's own
  // "problems first" ranking is applied on top of this when it asks for it.
  return orders.sort((a, b) => a.ageHours - b.ageHours);
}

function buildConnectors(now: Date): ConnectorStatus[] {
  return [
    {
      channel: "shopify",
      connected: true,
      account_label: SHOP_DOMAIN,
      last_synced_at: stamp(hoursAgo(now, 1)),
      stale: false,
    },
    {
      channel: "amazon",
      connected: true,
      account_label: "A2XKAVYAHOME01",
      marketplace: "Amazon.in",
      // Deliberately behind: the Dashboard has an alert for a stale channel and
      // the Channels tab has a dot, and neither can be looked at if every
      // connection is perfectly fresh.
      last_synced_at: stamp(hoursAgo(now, 27)),
      stale: true,
    },
  ];
}

let cached: DemoWorld | undefined;

/**
 * The world, built once per server process.
 *
 * Lazy rather than at module load so importing this file costs nothing on a
 * request that does not touch it, and cached so two tabs opened a minute apart
 * do not disagree about what "today" means.
 */
export function world(): DemoWorld {
  if (cached) return cached;
  const now = new Date();
  cached = {
    now,
    products: CATALOGUE,
    listings: buildListings(now),
    orders: buildOrders(now),
    channelProducts: buildChannelProducts(now),
    stockRows: buildStock(now, 14),
    purchaseOrders: buildPurchaseOrders(now),
    connectors: buildConnectors(now),
  };
  return cached;
}

export { THRESHOLDS, buildStock };
