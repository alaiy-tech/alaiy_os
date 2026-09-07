import type { ChannelId, FulfilmentFilter, OrderFlagKey } from "@/lib/backend/types";

/**
 * Reading and rebuilding a listing's query string.
 *
 * The Orders and Inventory tabs keep every bit of their state — filters, sort,
 * offset — in the URL, so these helpers are what both pages use to parse what
 * arrived and to build the links that change one part of it while preserving
 * the rest. Nothing here touches the backend, so it is safe on either side.
 *
 * Everything is validated against a known set rather than passed through. The
 * backend whitelists its own sort columns too, but a value that fails here
 * never becomes a request in the first place.
 */

export type RawParams = Record<string, string | string[] | undefined>;

/** `?a=1&a=2` arrives as an array. A filter only ever means one value. */
export function firstValue(value: string | string[] | undefined): string | undefined {
  const single = Array.isArray(value) ? value[0] : value;
  const trimmed = single?.trim();
  return trimmed ? trimmed : undefined;
}

const CHANNELS: ChannelId[] = ["shopify", "amazon"];

/** undefined means "all channels", which is the default view. */
export function parseChannel(value: string | string[] | undefined): ChannelId | undefined {
  const raw = firstValue(value);
  return CHANNELS.find((channel) => channel === raw);
}

export function parseDirection(value: string | string[] | undefined): "asc" | "desc" {
  return firstValue(value) === "asc" ? "asc" : "desc";
}

/** Offsets come back as strings and can be anything. Clamp to a sane page. */
export function parseOffset(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(firstValue(value) ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  // A hand-typed offset past the end would render an empty table with a pager
  // claiming there is more; the cap keeps it inside anything plausible.
  return Math.min(parsed, 100_000);
}

export function parseSortField<Field extends string>(
  value: string | string[] | undefined,
  allowed: readonly Field[],
  fallback: Field,
): Field {
  const raw = firstValue(value);
  return allowed.find((field) => field === raw) ?? fallback;
}

/**
 * How far back a listing looks. "all" is offered because the 90-day backfill
 * is the floor, not the ceiling — a seller who has been syncing for months has
 * older orders than any fixed window would show.
 */
export const WINDOW_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

/** Matches the backfill, so the tab is never empty right after onboarding. */
export const DEFAULT_WINDOW = "90";

export function parseWindow(value: string | string[] | undefined): string {
  const raw = firstValue(value);
  return WINDOW_OPTIONS.some((option) => option.value === raw) ? raw! : DEFAULT_WINDOW;
}

/**
 * The date `window` days ago, as YYYY-MM-DD, or undefined for "all".
 *
 * Date-only rather than a timestamp: the seller is asking for "the last 30
 * days", and an exact instant would cut the earliest day in half depending on
 * when they happened to load the page.
 */
export function windowStart(window: string, today = new Date()): string | undefined {
  if (window === "all") return undefined;
  const days = Number.parseInt(window, 10);
  if (!Number.isFinite(days)) return undefined;
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  return from.toISOString().slice(0, 10);
}

const FLAGS: OrderFlagKey[] = [
  "unfulfillable",
  "payment_pending",
  "stuck",
  "refunded",
  "cancelled",
];

/** undefined means "any", which is the default view. */
export function parseFlag(
  value: string | string[] | undefined,
): OrderFlagKey | "attention" | "clean" | undefined {
  const raw = firstValue(value);
  if (raw === "attention" || raw === "clean") return raw;
  return FLAGS.find((flag) => flag === raw);
}

/** Amazon's AFN, or everything the seller ships themselves. */
export function parseFulfilment(
  value: string | string[] | undefined,
): FulfilmentFilter | undefined {
  const raw = firstValue(value);
  return raw === "fba" || raw === "merchant" ? raw : undefined;
}

/**
 * A money bound from the filter bar.
 *
 * Undefined for anything that is not a number a seller could have meant. A
 * negative bound is dropped rather than clamped to zero: "-50" in an amount
 * box is a typo, and silently reading it as "everything" is the honest
 * response to not knowing what they wanted.
 */
export function parseAmount(value: string | string[] | undefined): number | undefined {
  const raw = firstValue(value);
  if (raw === undefined) return undefined;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

/**
 * Which order the detail panel is showing, as "channel:external id".
 *
 * One parameter rather than two because it is one selection, and because an
 * order id is only unique within its channel. The id is not validated beyond
 * being present — it goes to the backend, which resolves it inside the
 * session's own workspace or does not resolve it at all.
 */
export function parseSelectedOrder(
  value: string | string[] | undefined,
): { channel: ChannelId; externalOrderId: string } | undefined {
  const raw = firstValue(value);
  if (!raw) return undefined;
  const separator = raw.indexOf(":");
  if (separator < 1) return undefined;
  const channel = CHANNELS.find((id) => id === raw.slice(0, separator));
  const externalOrderId = raw.slice(separator + 1);
  if (!channel || !externalOrderId) return undefined;
  return { channel, externalOrderId };
}

export function selectedOrderKey(channel: string, externalOrderId: string): string {
  return `${channel}:${externalOrderId}`;
}

/** The query a listing link carries. Values are strings, as they are in a URL. */
export type ListingQuery = {
  q?: string;
  channel?: string;
  window?: string;
  sort: string;
  dir: string;
  start?: number;
  /** Orders only. */
  flag?: string;
  fulfilment?: string;
  min?: string;
  max?: string;
  order?: string;
};

/**
 * A built href as a plain string.
 *
 * The object form is what everything here produces and what `Link` wants. Two
 * places need the string instead — a client component pushing a route, and the
 * export anchor — and both would otherwise assemble the query themselves.
 */
export function hrefToString(href: {
  pathname: string;
  query: Record<string, string>;
}): string {
  const search = new URLSearchParams(href.query).toString();
  return search ? `${href.pathname}?${search}` : href.pathname;
}

/**
 * `href` for the same listing with some of the query changed.
 *
 * The object form, so nothing has to escape or concatenate a query string, and
 * empty values are dropped rather than left as `?q=&channel=` noise.
 */
export function listingHref(
  pathname: string,
  current: ListingQuery,
  overrides: Partial<ListingQuery> = {},
): { pathname: string; query: Record<string, string> } {
  const merged = { ...current, ...overrides };
  const query: Record<string, string> = {};

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "" || value === null) continue;
    // Page one is the absence of an offset, not `start=0`.
    if (key === "start" && Number(value) === 0) continue;
    query[key] = String(value);
  }

  return { pathname, query };
}
