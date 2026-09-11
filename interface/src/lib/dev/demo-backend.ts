import type {
  AccountHealth,
  BackendWorkspace,
  ChannelId,
  ChannelOrder,
  ChannelProduct,
  ConnectorStatus,
  ContributingOrders,
  DashboardTiles,
  HealthMetric,
  HealthTrend,
  HomeAlert,
  HomeDashboard,
  ImportJob,
  InventorySummaryRow,
  LateRiskOrder,
  OrderFlagKey,
  OrderFlagRules,
  OrderTotals,
  OrdersPage,
  ReturnRateMetric,
  TileMetric,
  UnsettledMetric,
} from "@/lib/backend/types";
import type { Listing, ListingsPage } from "@/lib/listings/types";
import type { ProductsPage } from "@/lib/backend/inventory";
import type { StockPage } from "@/lib/inventory/types";
import { DEMO_WORKSPACE } from "@/lib/dev/demo";
import {
  DEMO_CURRENCY,
  DEMO_RULES,
  THRESHOLDS,
  buildStock,
  day,
  hoursAgo,
  stamp,
  world,
  type DemoOrder,
} from "@/lib/dev/demo-seed";
import * as chat from "@/lib/dev/demo-chat";
import { sellerCentral } from "@/lib/dev/demo-links";
import { profitability, ratings, shipping } from "@/lib/dev/demo-tabs";

/**
 * The backend, for a machine that has none.
 *
 * `backendRequest` hands every call here when `ALAIY_DEMO=1`, before a socket
 * is opened — so demo mode needs no bench, no credentials and no network, and
 * the modules under `lib/backend/` that call it are untouched. Each handler
 * answers the shape its endpoint's TypeScript type promises, which is what
 * makes this checkable: a field the real backend adds becomes a type error
 * here rather than an `undefined` on a screen.
 *
 * The filters, the sort and the pager are implemented rather than ignored.
 * Returning the same fifty rows whatever was asked would make every control on
 * these tabs untestable, which is most of what there is to test.
 */

type Query = Record<string, string | number | boolean | undefined | null>;

const str = (query: Query | undefined, key: string): string | undefined => {
  const value = query?.[key];
  return value === undefined || value === null || value === "" ? undefined : String(value);
};

const num = (query: Query | undefined, key: string): number | undefined => {
  const value = str(query, key);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/* --- mutable state, so the tabs' own actions do something ---------------- */

/**
 * What a Server Action changes.
 *
 * The flag thresholds, a dismissed alert and a disconnected channel are the
 * three mutations the signed-in app has, and a demo mode where the button
 * visibly does nothing is a demo mode that cannot be used to check the button.
 * Per-process, and forgotten on restart, like everything else here.
 */
const state = {
  rules: { ...DEMO_RULES } as OrderFlagRules,
  dismissed: new Set<string>(),
  disconnected: new Set<ChannelId>(),
  resyncedAt: new Map<ChannelId, string>(),
};

/**
 * The Seller Central page above a tab, or null.
 *
 * Null the moment Amazon is disconnected on the Channels tab — the mark is
 * meant to disappear rather than point a seller at an account they no longer
 * have attached, and that is a state this mode can actually produce.
 */
function sellerCentralFor(tab: string): string | null {
  return state.disconnected.has("amazon") ? null : sellerCentral.tab(tab);
}

function connectors(): ConnectorStatus[] {
  return world().connectors.map((connector) => {
    if (state.disconnected.has(connector.channel)) {
      return { channel: connector.channel, connected: false };
    }
    const resynced = state.resyncedAt.get(connector.channel);
    return resynced
      ? { ...connector, last_synced_at: resynced, stale: false }
      : connector;
  });
}

/* --- windows and metrics ------------------------------------------------- */

/** Orders placed within the last `hours`, or in the window before it. */
function inWindow(orders: DemoOrder[], fromHours: number, toHours: number) {
  return orders.filter((order) => order.ageHours >= toHours && order.ageHours < fromHours);
}

const gmvOf = (orders: DemoOrder[]) =>
  Math.round(orders.reduce((sum, order) => sum + (order.merchandise_total ?? 0), 0));

function tile(value: number, previous: number): TileMetric {
  return {
    value,
    previous,
    // Null rather than a percentage, because growth from nothing has none —
    // and the tile renders no arrow when it is null, which is the point.
    change_pct: previous > 0 ? Number((((value - previous) / previous) * 100).toFixed(1)) : null,
  };
}

function returnRate(current: DemoOrder[], prior: DemoOrder[]): ReturnRateMetric {
  const returned = (orders: DemoOrder[]) =>
    orders.filter(
      (order) => order.flags.includes("refunded") || order.flags.includes("cancelled"),
    ).length;

  const rate = (orders: DemoOrder[]) =>
    orders.length ? Number(((returned(orders) / orders.length) * 100).toFixed(1)) : 0;

  const value = rate(current);
  const previous = rate(prior);
  return {
    value,
    previous,
    change_pp: Number((value - previous).toFixed(1)),
    returned_orders: returned(current),
    basis: "refunds_and_cancellations",
  };
}

/** Settlements are not synced in this world, and the tile says so rather than
 *  showing a zero that would read as "you are owed nothing". */
const UNSETTLED: UnsettledMetric = {
  available: false,
  value: null,
  overdue_count: null,
  reason: "Settlement sync isn't connected on this workspace yet.",
};

function tiles(days: number): DashboardTiles {
  const { orders, now } = world();
  const current = inWindow(orders, days * 24, 0);
  const prior = inWindow(orders, days * 48, days * 24);

  return {
    window: {
      days,
      from: day(hoursAgo(now, days * 24)),
      to: day(now),
      compare_from: day(hoursAgo(now, days * 48)),
      compare_to: day(hoursAgo(now, days * 24)),
    },
    currency: DEMO_CURRENCY,
    mixed_currencies: false,
    has_any_orders: orders.length > 0,
    gmv: tile(gmvOf(current), gmvOf(prior)),
    orders: tile(current.length, prior.length),
    return_rate: returnRate(current, prior),
    unsettled: UNSETTLED,
  };
}

/**
 * The alerts, computed from the same rows the tabs show.
 *
 * Three detectors, each pointing at the tab where the thing can be fixed —
 * which is the contract the bar is built on. A dismissal is keyed on
 * `key`, so dismissing one here keeps it dismissed until the server restarts.
 */
function alerts(): HomeAlert[] {
  const { orders, stockRows } = world();
  const found: HomeAlert[] = [];

  // Oldest first, because that is the one the alert names.
  const stuck = orders
    .filter((order) => order.flags.includes("stuck"))
    .sort((a, b) => b.ageHours - a.ageHours);
  if (stuck.length) {
    found.push({
      key: "orders_unshipped",
      severity: 80,
      tone: "alert",
      title: `${stuck.length} orders are past their ship-by`,
      detail: `Still unshipped after ${state.rules.unshipped_hours} hours — ${state.rules.fba_unshipped_hours} for the ones Amazon ships. The oldest has been sitting ${Math.round((stuck[0]?.ageHours ?? 0) / 24)} days.`,
      tab: "orders",
      query: { flag: "stuck" },
      fingerprint: `stuck:${stuck.length}`,
    });
  }

  const critical = stockRows
    .filter((row) => row.band === "critical")
    .sort((a, b) => (a.days_of_cover ?? 0) - (b.days_of_cover ?? 0));
  if (critical.length) {
    found.push({
      key: "inventory_cover",
      severity: 60,
      tone: "warn",
      title: `${critical.length} listings run out within a week`,
      detail: `${critical[0]?.brand_sku} has ${critical[0]?.days_of_cover ?? 0} days of cover left at its current rate, and nothing on order covers it in time.`,
      tab: "inventory",
      query: { view: "stock" },
      fingerprint: `cover:${critical.length}`,
    });
  }

  const stale = connectors().filter((connector) => connector.connected && connector.stale);
  if (stale.length) {
    found.push({
      key: "channel_stale",
      severity: 40,
      tone: "info",
      title: `${stale[0].channel === "amazon" ? "Amazon" : "Shopify"} hasn't synced since yesterday`,
      detail:
        "Every figure on this screen for that channel is as of its last pull, not as of now.",
      tab: "channels",
      query: {},
      fingerprint: `stale:${stale.map((c) => c.channel).join(",")}`,
    });
  }

  return found
    .filter((alert) => !state.dismissed.has(alert.key))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 3);
}

function homeDashboard(): HomeDashboard {
  const { orders, now } = world();
  const hourOfDay = now.getHours() + 1;

  // Today so far, against the same stretch of the same weekday last week — a
  // partial day compared against a whole one would report a collapse every
  // morning, which is the trap the real endpoint documents.
  const today = inWindow(orders, hourOfDay, 0);
  const lastWeek = inWindow(orders, 24 * 7 + hourOfDay, 24 * 7);
  const rolling = inWindow(orders, 24 * 7, 0);
  const rollingPrior = inWindow(orders, 24 * 14, 24 * 7);

  return {
    as_of: stamp(now),
    currency: DEMO_CURRENCY,
    mixed_currencies: false,
    has_any_orders: orders.length > 0,
    windows: {
      today: { from: day(now), to: day(now) },
      compare: { from: day(hoursAgo(now, 24 * 7)), to: day(hoursAgo(now, 24 * 7)) },
      rolling: { from: day(hoursAgo(now, 24 * 7)), to: day(now), days: 7 },
      rolling_compare: {
        from: day(hoursAgo(now, 24 * 14)),
        to: day(hoursAgo(now, 24 * 7)),
      },
    },
    gmv: tile(gmvOf(today), gmvOf(lastWeek)),
    orders: tile(today.length, lastWeek.length),
    return_rate: returnRate(rolling, rollingPrior),
    unsettled: UNSETTLED,
    alerts: alerts(),
  };
}

/* --- orders -------------------------------------------------------------- */

function matchesOrder(order: DemoOrder, query: Query): boolean {
  const channel = str(query, "channel");
  if (channel && order.channel !== channel) return false;

  const fulfilment = str(query, "fulfilment");
  if (fulfilment === "fba" && !order.fba) return false;
  if (fulfilment === "merchant" && order.fba) return false;

  const search = str(query, "search")?.toLowerCase();
  if (search) {
    const haystack = [
      order.order_number,
      order.customer_name,
      order.external_order_id,
      ...order.skus,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  const min = num(query, "min_amount");
  if (min !== undefined && (order.order_total ?? 0) < min) return false;
  const max = num(query, "max_amount");
  if (max !== undefined && (order.order_total ?? 0) > max) return false;

  const from = str(query, "from_date");
  if (from && (order.order_date ?? "") < from) return false;
  const to = str(query, "to_date");
  // Inclusive of the whole day, the way the backend widens it to midnight.
  if (to && (order.order_date ?? "") > `${to} 23:59:59`) return false;

  return true;
}

function matchesFlag(order: DemoOrder, flag?: string): boolean {
  if (!flag) return true;
  if (flag === "attention") return order.needs_attention;
  if (flag === "clean") return order.flags.length === 0;
  return order.flags.includes(flag as OrderFlagKey);
}

function sortOrders(rows: DemoOrder[], by?: string, direction?: string): DemoOrder[] {
  const dir = direction === "asc" ? 1 : -1;
  const sorted = [...rows];

  if (!by || by === "attention") {
    // The ranking the tab exists for: flagged first, newest inside that.
    return sorted.sort(
      (a, b) => b.severity - a.severity || a.ageHours - b.ageHours,
    );
  }

  return sorted.sort((a, b) => {
    if (by === "order_date" || by === "last_synced_at") {
      return (b.ageHours - a.ageHours) * -dir;
    }
    const left = a[by as keyof ChannelOrder];
    const right = b[by as keyof ChannelOrder];
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * dir;
    }
    return String(left ?? "").localeCompare(String(right ?? "")) * dir;
  });
}

function totalsFor(view: DemoOrder[], unflagged: DemoOrder[]): OrderTotals {
  const orderValue = Math.round(
    view.reduce((sum, order) => sum + (order.order_total ?? 0), 0),
  );
  return {
    orders: view.length,
    units: view.reduce((sum, order) => sum + (order.units ?? 0), 0),
    // Deliberately measured over the view *before* the flag filter, so the
    // chip's count does not change the moment you click it.
    attention: unflagged.filter((order) => order.needs_attention).length,
    currency: DEMO_CURRENCY,
    order_value: orderValue,
    merchandise_value: gmvOf(view),
    mixed_currencies: false,
    by_currency: [{ currency: DEMO_CURRENCY, orders: view.length, order_value: orderValue }],
  };
}

/** The demo order, stripped of the two bookkeeping fields the API never sends. */
function present(order: DemoOrder): ChannelOrder {
  const { lines: _lines, destination: _destination, fba: _fba, ageHours: _age, ...row } = order;
  return row;
}

function listOrders(query: Query): OrdersPage {
  const { orders } = world();
  const unflagged = orders.filter((order) => matchesOrder(order, query));
  const view = unflagged.filter((order) => matchesFlag(order, str(query, "flag")));

  const sorted = sortOrders(view, str(query, "order_by"), str(query, "order"));
  const start = num(query, "start") ?? 0;
  const limit = num(query, "limit") ?? 50;

  return {
    rows: sorted.slice(start, start + limit).map(present),
    total: view.length,
    start,
    limit,
    totals: totalsFor(view, unflagged),
    rules: state.rules,
    seller_central: sellerCentralFor("orders"),
  };
}

/* --- listings ------------------------------------------------------------ */

function listListings(query: Query): ListingsPage {
  const { listings } = world();
  const health = str(query, "health");
  const channel = str(query, "channel");
  const category = str(query, "category");

  const view = listings.filter((listing) => {
    if (health && listing.health !== health) return false;
    if (channel && listing.channel !== channel) return false;
    if (category && listing.category !== category) return false;
    return true;
  });

  const start = num(query, "start") ?? 0;
  const limit = num(query, "limit") ?? 50;

  return {
    // False, and it matters: this flag is what the "sample data" banner renders
    // off, and the whole app is sample data here — a banner on every screen
    // would be noise rather than a warning. The badge in the shell says it once.
    sample: false,
    listings: view.slice(start, start + limit),
    total: view.length,
    start,
    limit,
    categories: [...new Set(listings.map((listing) => listing.category!))].filter(Boolean).sort(),
    seller_central: sellerCentralFor("listings"),
  };
}

/* --- inventory ----------------------------------------------------------- */

function listProducts(query: Query): ProductsPage {
  const { channelProducts } = world();
  const channel = str(query, "channel");
  const search = str(query, "search")?.toLowerCase();

  const view = channelProducts.filter((product) => {
    if (channel && product.channel !== channel) return false;
    if (search) {
      const haystack = `${product.sku} ${product.title}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const by = str(query, "order_by");
  const dir = str(query, "order") === "asc" ? 1 : -1;
  if (by) {
    view.sort((a, b) => {
      const left = a[by as keyof ChannelProduct];
      const right = b[by as keyof ChannelProduct];
      if (typeof left === "number" && typeof right === "number") return (left - right) * dir;
      return String(left ?? "").localeCompare(String(right ?? "")) * dir;
    });
  }

  const start = num(query, "start") ?? 0;
  const limit = num(query, "limit") ?? 50;
  return {
    rows: view.slice(start, start + limit),
    total: view.length,
    start,
    limit,
    seller_central: sellerCentralFor("inventory"),
  };
}

function inventorySummary(): InventorySummaryRow[] {
  const { channelProducts } = world();
  return (["shopify", "amazon"] as ChannelId[]).map((channel) => {
    const rows = channelProducts.filter((product) => product.channel === channel);
    return {
      channel,
      products: rows.length,
      units: rows.reduce((sum, product) => sum + (product.available_qty ?? 0), 0),
    };
  });
}

function stockPage(query: Query): StockPage {
  const velocityDays = num(query, "velocity_days") ?? 14;
  return {
    sample: false,
    // Rebuilt per window rather than filtered: the whole point of the toggle is
    // that the sell-through rate, and so the cover, is averaged over it.
    rows: buildStock(world().now, velocityDays),
    purchase_orders: world().purchaseOrders,
    has_wms: true,
    thresholds: THRESHOLDS,
    velocity_days: velocityDays,
  };
}

/* --- account health ------------------------------------------------------ */

type SeedMetric = {
  key: string;
  label: string;
  section: string;
  value: number | null;
  target: number;
  higherIsBetter: boolean;
  primary: boolean;
};

const HEALTH_METRICS: SeedMetric[] = [
  { key: "orderDefectRate", label: "Order Defect Rate", section: "customer_service", value: 0.82, target: 1, higherIsBetter: false, primary: true },
  { key: "lateShipmentRate", label: "Late Shipment Rate", section: "shipping", value: 4.6, target: 4, higherIsBetter: false, primary: true },
  { key: "preFulfillmentCancelRate", label: "Pre-fulfilment Cancel Rate", section: "shipping", value: 1.1, target: 2.5, higherIsBetter: false, primary: true },
  { key: "validTrackingRate", label: "Valid Tracking Rate", section: "shipping", value: 97.4, target: 95, higherIsBetter: true, primary: true },
  { key: "onTimeDeliveryRate", label: "On-time Delivery Rate", section: "shipping", value: 93.8, target: 97, higherIsBetter: true, primary: false },
  { key: "invoiceDefectRate", label: "Invoice Defect Rate", section: "customer_service", value: 0.4, target: 5, higherIsBetter: false, primary: false },
  { key: "returnDissatisfactionRate", label: "Return Dissatisfaction Rate", section: "customer_service", value: null, target: 10, higherIsBetter: false, primary: false },
];

function healthMetric(seed: SeedMetric, now: Date): HealthMetric {
  // Signed the same way on every metric: positive is room to spare. That
  // normalisation is the backend's job, and doing it here too is what keeps the
  // tiles from having to explain that +0.3 is good on one and bad on another.
  const headroom =
    seed.value === null
      ? null
      : Number(
          (seed.higherIsBetter ? seed.value - seed.target : seed.target - seed.value).toFixed(2),
        );

  const status: HealthMetric["health_status"] =
    headroom === null
      ? "unknown"
      : headroom < 0
        ? "critical"
        : headroom < seed.target * 0.2
          ? "warn"
          : "ok";

  return {
    metric_key: seed.key,
    metric_label: seed.label,
    section: seed.section,
    metric_value: seed.value,
    metric_target: seed.target,
    higher_is_better: seed.higherIsBetter ? 1 : 0,
    health_status: status,
    headroom,
    primary: seed.primary,
    as_of_date: day(hoursAgo(now, 24)),
    synced_at: stamp(hoursAgo(now, 6)),
    defect_guarantees: seed.key === "orderDefectRate" ? 3 : null,
    defect_chargebacks: seed.key === "orderDefectRate" ? 1 : null,
    marketplace_id: "A21TJRUUN4KGV",
  };
}

/** The Amazon orders at risk of shipping late — the outlook's own evidence. */
function lateRisk(): LateRiskOrder[] {
  const { orders, now } = world();
  return orders
    .filter((order) => order.channel === "amazon" && order.flags.includes("stuck"))
    .sort((a, b) => b.ageHours - a.ageHours)
    .slice(0, 8)
    .map((order) => ({
      external_order_id: order.external_order_id,
      order_number: order.order_number ?? null,
      order_date: order.order_date ?? null,
      promised_ship_by: stamp(hoursAgo(now, order.ageHours - 48)),
      order_status: order.order_status ?? null,
      currency: order.currency ?? null,
      order_total: order.order_total ?? null,
      units: order.units ?? 0,
      products: order.skus,
    }));
}

function accountHealth(): AccountHealth {
  const { now, orders } = world();
  if (state.disconnected.has("amazon")) {
    return {
      connected: false,
      status: "unknown",
      metrics: [],
      late_shipment: null,
      gaps: [],
      synced_at: null,
      never_synced: false,
      seller_central: null,
    };
  }

  const metrics = HEALTH_METRICS.map((seed) => healthMetric(seed, now));
  const breached = metrics.some((metric) => metric.health_status === "critical");
  const atRisk = metrics.some((metric) => metric.health_status === "warn");
  const atRiskOrders = lateRisk();
  const amazonOrders = orders.filter(
    (order) => order.channel === "amazon" && order.ageHours <= 24 * 30,
  ).length;

  return {
    connected: true,
    status: breached ? "action_required" : atRisk ? "at_risk" : "healthy",
    metrics,
    late_shipment: {
      current: 4.6,
      target: 4,
      // Where the rate lands if every at-risk order goes out late.
      projected: Number(
        (4.6 + (atRiskOrders.length / Math.max(amazonOrders, 1)) * 100).toFixed(1),
      ),
      breaches: true,
      at_risk_count: atRiskOrders.length,
      at_risk: atRiskOrders,
      denominator: amazonOrders,
      window_days: 30,
      estimated: true,
    },
    gaps: [
      {
        key: "defect_attribution",
        title: "Which orders caused a defect",
        detail:
          "Amazon reports the Order Defect Rate but not the orders behind it, so this tab can show you the rate and the claims count and not the individual orders.",
      },
      {
        key: "buyer_seller_messaging",
        title: "Response time",
        detail:
          "Buyer-seller messaging metrics need the Messaging API, which this workspace is not authorised for.",
      },
    ],
    synced_at: stamp(hoursAgo(now, 6)),
    never_synced: false,
    seller_central: sellerCentralFor("account-health"),
  };
}

function healthTrend(days: number): HealthTrend {
  const { now } = world();
  // Amazon's report has no backfill, so the chart honestly has far fewer days
  // than its axis — which is the case the `available_days` field exists for.
  const available = 22;
  const rows = [];
  for (const seed of HEALTH_METRICS) {
    if (seed.value === null) continue;
    for (let back = available - 1; back >= 0; back -= 1) {
      // A gentle drift towards today's reading, so a line has a shape.
      const drift = Math.sin(back / 3.1 + seed.key.length) * seed.target * 0.06;
      rows.push({
        metric_key: seed.key,
        as_of_date: day(hoursAgo(now, 24 * (back + 1))),
        metric_value: Number(Math.max(0, seed.value + drift).toFixed(2)),
        metric_target: seed.target,
      });
    }
  }
  return {
    days,
    rows,
    available_days: available,
    targets: Object.fromEntries(HEALTH_METRICS.map((seed) => [seed.key, seed.target])),
  };
}

function contributing(metricKey: string): ContributingOrders {
  if (metricKey === "lateShipmentRate") {
    return { metric_key: metricKey, supported: true, basis: "unshipped_past_promise", rows: lateRisk() };
  }

  if (metricKey === "orderDefectRate") {
    const { now } = world();
    return {
      metric_key: metricKey,
      supported: true,
      basis: "negative_feedback",
      rows: lateRisk()
        .slice(0, 3)
        .map((order, index) => ({
          ...order,
          rating: index === 0 ? 1 : 2,
          comment:
            index === 0
              ? "Arrived two weeks after the delivery date I was given. No updates in between."
              : "Packaging was crushed and one cup was chipped.",
          feedback_date: day(hoursAgo(now, 24 * (index + 2))),
        })),
    };
  }

  // Not an empty list: an empty list under a bad metric reads as "no orders are
  // responsible for this", which is a different and much stronger claim.
  return { metric_key: metricKey, supported: false, rows: [] };
}

/* --- imports ------------------------------------------------------------- */

function finishedImport(): ImportJob {
  const { now } = world();
  return {
    id: "demo-import-1",
    status: "completed",
    progress: 100,
    steps: (["shopify", "amazon"] as ChannelId[]).flatMap((channel) =>
      (["orders", "inventory"] as const).map((id) => ({
        id,
        channel,
        status: "done" as const,
        processed: id === "orders" ? 214 : 26,
      })),
    ),
    started_at: stamp(hoursAgo(now, 48)),
    completed_at: stamp(hoursAgo(now, 47)),
  };
}

/* --- the router ---------------------------------------------------------- */

const workspace = (): BackendWorkspace => ({
  id: DEMO_WORKSPACE,
  company_name: DEMO_WORKSPACE,
  tier: "growth",
  status: "ready",
  profile_complete: true,
  onboarding_complete: true,
  flag_rules: state.rules,
});

type Handler = (query: Query, body: Record<string, unknown>) => unknown;

const ROUTES: Record<string, Handler> = {
  /* workspace */
  "api.workspace.get": () => workspace(),
  "api.workspace.save_profile": () => workspace(),
  "api.workspace.save_flag_rules": (_query, body) => {
    for (const key of ["pending_payment_hours", "unshipped_hours", "fba_unshipped_hours"] as const) {
      const value = Number(body[key]);
      if (Number.isFinite(value)) state.rules[key] = value;
    }
    return workspace();
  },

  /* connections */
  "api.connections.list_connections": () => connectors(),
  "api.connections.amazon_app_status": () => ({
    ready: true,
    missing: [],
    sandbox: false,
    draft: false,
  }),
  "api.connections.connect_shopify": () => {
    state.disconnected.delete("shopify");
    return connectors().find((connector) => connector.channel === "shopify");
  },
  // Nowhere to send a browser in this mode, so it goes back to the tab it came
  // from rather than out to a consent screen that would 404 on a fake client id.
  "api.connections.amazon_connect_url": () => ({ url: "/channels?connected=amazon" }),
  "api.connections.disconnect": (_query, body) => {
    const channel = String(body.channel) as ChannelId;
    state.disconnected.add(channel);
    return { channel, connected: false };
  },

  /* imports */
  "api.imports.latest": () => null,
  "api.imports.status": () => finishedImport(),
  "api.imports.start": () => finishedImport(),
  "api.imports.resync": (_query, body) => {
    const channel = String(body.channel) as ChannelId;
    state.resyncedAt.set(channel, stamp(new Date()));
    return { queued: true, job: `demo-sync-${channel}` };
  },

  /* dashboard */
  "api.dashboard.home": () => homeDashboard(),
  "api.dashboard.tiles": (query) => tiles(num(query, "days") ?? 7),
  "api.dashboard.dismiss_alert": (_query, body) => {
    state.dismissed.add(String(body.key));
    return { dismissed: true };
  },

  /* orders */
  "api.orders.list_orders": (query) => listOrders(query),
  "api.orders.order_detail": (query) => {
    const order = world().orders.find(
      (row) =>
        row.channel === str(query, "channel") &&
        row.external_order_id === str(query, "external_order_id"),
    );
    if (!order) return null;
    return { ...present(order), lines: order.lines, destination: order.destination };
  },

  /* listings */
  "api.listings.overview": (query) => listListings(query),
  "api.listings.listing": (query) => {
    const listing: Listing | undefined = world().listings.find(
      (row) => row.id === str(query, "listing_id"),
    );
    return listing ? { ...listing, sample: false } : null;
  },

  /* inventory */
  "api.inventory.list_products": (query) => listProducts(query),
  "api.inventory.summary": () => inventorySummary(),
  "api.inventory.stock": (query) => stockPage(query),

  /* shipping, profitability, ratings — one read each */
  "api.shipping.overview": (query) => shipping(num(query, "days") ?? 30),
  "api.shipping.refresh": () => ({ queued: true, job: "demo-shipping-refresh" }),
  "api.profitability.overview": (query) => profitability(num(query, "days") ?? 30),
  "api.profitability.refresh": () => ({ queued: true, job: "demo-profitability-refresh" }),
  "api.ratings.overview": () => ratings(),
  "api.ratings.refresh": () => ({ queued: true, job: "demo-ratings-refresh" }),

  /* account health */
  "api.account_health.overview": () => accountHealth(),
  "api.account_health.trend": (query) => healthTrend(num(query, "days") ?? 60),
  "api.account_health.contributing": (query) =>
    contributing(str(query, "metric_key") ?? ""),
  "api.account_health.refresh": () => ({ queued: true, job: "demo-health-refresh" }),
};

/** Ask Alaiy lives in alaiy_os core, under its own module name. */
const CHAT_ROUTES: Record<string, Handler> = {
  create_session: (_query, body) => chat.createSession(body.title as string | undefined),
  list_sessions: (query) => chat.listSessions(num(query, "limit") ?? 30),
  send_message: (_query, body) =>
    chat.sendMessage(String(body.session), String(body.text ?? "")),
  get_messages: (query) =>
    chat.getMessages(
      str(query, "session") ?? "",
      num(query, "after") ?? 0,
      str(query, "partial") !== "0",
    ),
  delete_session: (_query, body) => {
    chat.deleteSession(String(body.session));
    return null;
  },
};

/**
 * Answer one backend call.
 *
 * Unknown paths throw rather than returning null. Every reader in
 * `lib/backend/` already handles a failure by rendering its notice, so an
 * endpoint this file has not learned yet shows up as a visible message naming
 * the method — which is a bug report — instead of an empty table that looks
 * like a design decision.
 */
export function answerDemoRequest(
  path: string,
  query: Query | undefined,
  body: unknown,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const method = path.replace(/^\/?api\/method\//, "");
  const payload = (body ?? {}) as Record<string, unknown>;

  if (method.startsWith("alaiy_os.api.chat.")) {
    const handler = CHAT_ROUTES[method.slice("alaiy_os.api.chat.".length)];
    if (handler) return { ok: true, value: handler(query ?? {}, payload) };
  }

  if (method.startsWith("alaiy_os_self_serve_apis.")) {
    const handler = ROUTES[method.slice("alaiy_os_self_serve_apis.".length)];
    if (handler) return { ok: true, value: handler(query ?? {}, payload) };
  }

  return {
    ok: false,
    message: `Demo mode has no answer for ${method}. Add it to src/lib/dev/demo-backend.ts.`,
  };
}

