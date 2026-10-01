import type { ChannelId, ChannelOrder } from "@/lib/backend/types";

/**
 * Home's figures, computed from orders rather than read from an endpoint.
 *
 * There is no time-series or per-channel-revenue method on the backend. What
 * there is, is `listOrders`, which answers whole orders with a date, a channel
 * and a total — so the month figures, the chart and the per-store cards are
 * all one pass over one fetch rather than four reads that could disagree with
 * each other about what "this month" means.
 *
 * That is the ceiling on this screen, and it is a real one: everything here
 * covers the window that was fetched and nothing claims more. A 7/30/90-day
 * toggle is deliberately absent for that reason — see `sales-performance.tsx`.
 *
 * Pure, and no `server-only`: the chart narrows the same rollup on the client
 * when a seller switches which store they are looking at.
 */

/**
 * The two stretches a month-on-month figure compares.
 *
 * Like-for-like, which is the whole difficulty. A full previous month against
 * eleven days of this one is not a comparison, it is an accusation — so the
 * baseline is the *same number of days* from the start of last month. On the
 * 31st of a month following a 30-day one the baseline simply stops at the
 * 30th; a day that does not exist cannot be included, and clamping is honest
 * where rolling into this month would double-count.
 */
export type MonthWindows = {
  /** "YYYY-MM-DD", inclusive. */
  thisStart: string;
  thisEnd: string;
  lastStart: string;
  lastEnd: string;
  /** Days elapsed this month, including today. */
  days: number;
};

export function monthWindows(today: Date): MonthWindows {
  const year = today.getFullYear();
  const month = today.getMonth();
  const dayOfMonth = today.getDate();

  const lastMonthEnd = new Date(year, month, 0).getDate();
  const baselineDay = Math.min(dayOfMonth, lastMonthEnd);

  return {
    thisStart: iso(new Date(year, month, 1)),
    thisEnd: iso(new Date(year, month, dayOfMonth)),
    lastStart: iso(new Date(year, month - 1, 1)),
    lastEnd: iso(new Date(year, month - 1, baselineDay)),
    days: dayOfMonth,
  };
}

/** The earliest date the fetch has to reach to cover both windows. */
export function overviewFrom(windows: MonthWindows): string {
  return windows.lastStart;
}

/** A figure and the same figure over the baseline stretch. */
export type Movement = {
  value: number;
  previous: number;
  /** Null when there is no baseline: growth from nothing has no percentage. */
  changePct: number | null;
};

/** One day's total, for the chart. `day` is the day of the month. */
export type DayPoint = { day: number; value: number };

export type StoreRollup = {
  channel: ChannelId;
  revenue: Movement;
  orders: number;
  /** This month's daily totals, for the card's sparkline. */
  spark: number[];
};

export type HomeOverview = {
  sales: Movement;
  orderCount: Movement;
  thisMonth: DayPoint[];
  lastMonth: DayPoint[];
  byChannel: StoreRollup[];
  /** True when the window produced nothing at all, either month. */
  empty: boolean;
  /**
   * Whether the month-on-month percentages are worth showing yet.
   *
   * On the 1st, "vs last month" is one day against one day, and a quiet
   * Tuesday against a busy one reads as +3000%. The arithmetic is right and
   * the statement is worthless — worse than worthless, because a seller acts
   * on it. Three days is where a like-for-like window stops being a single
   * day's noise; below that the tiles show the figure and say what it covers
   * instead of claiming a trend.
   */
  comparable: boolean;
};

export function summariseOrders(
  orders: ChannelOrder[],
  windows: MonthWindows,
): HomeOverview {
  const thisDays = windows.days;
  const lastDays = dayOf(windows.lastEnd);

  const thisMonth: DayPoint[] = Array.from({ length: thisDays }, (_, i) => ({
    day: i + 1,
    value: 0,
  }));
  const lastMonth: DayPoint[] = Array.from({ length: lastDays }, (_, i) => ({
    day: i + 1,
    value: 0,
  }));

  let sales = 0;
  let salesPrev = 0;
  let count = 0;
  let countPrev = 0;
  const stores = new Map<ChannelId, { revenue: number; previous: number; orders: number; spark: number[] }>();

  for (const order of orders) {
    const date = order.order_date?.slice(0, 10);
    if (!date) continue;
    // `order_total` is what the seller was paid for the order; a row without
    // one still counts as an order, which is why the two tallies are separate.
    const value = order.order_total ?? 0;
    const day = dayOf(date);

    const current = date >= windows.thisStart && date <= windows.thisEnd;
    const baseline = date >= windows.lastStart && date <= windows.lastEnd;
    if (!current && !baseline) continue;

    const store =
      stores.get(order.channel) ??
      { revenue: 0, previous: 0, orders: 0, spark: Array.from({ length: thisDays }, () => 0) };

    if (current) {
      sales += value;
      count += 1;
      if (day >= 1 && day <= thisDays) {
        thisMonth[day - 1].value += value;
        store.spark[day - 1] += value;
      }
      store.revenue += value;
      store.orders += 1;
    } else {
      salesPrev += value;
      countPrev += 1;
      if (day >= 1 && day <= lastDays) lastMonth[day - 1].value += value;
      store.previous += value;
    }

    stores.set(order.channel, store);
  }

  const byChannel: StoreRollup[] = [...stores.entries()]
    .map(([channel, store]) => ({
      channel,
      revenue: movement(store.revenue, store.previous),
      orders: store.orders,
      spark: store.spark,
    }))
    // Biggest earner first: the card a seller looks for is the one carrying
    // the most money, not the one whose name sorts first.
    .sort((a, b) => b.revenue.value - a.revenue.value);

  return {
    sales: movement(sales, salesPrev),
    orderCount: movement(count, countPrev),
    thisMonth,
    lastMonth,
    byChannel,
    empty: !count && !countPrev,
    comparable: windows.days >= 3,
  };
}

function movement(value: number, previous: number): Movement {
  return {
    value,
    previous,
    changePct: previous > 0 ? ((value - previous) / previous) * 100 : null,
  };
}

/** Day of the month out of a "YYYY-MM-DD", without constructing a Date. */
function dayOf(date: string): number {
  return Number(date.slice(8, 10));
}

function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
