import type { HomeAlert } from "@/lib/backend/types";

/**
 * How an alert reads, and where it goes.
 *
 * The backend decides *whether* something is wrong and what to say about it;
 * this decides what it looks like and which URL the seller lands on. Split
 * that way for the same reason `lib/orders/flags.ts` is: the detector owns the
 * observation, the frontend owns the presentation, and neither has to know the
 * other's vocabulary.
 *
 * Client-safe, because the bar is a client component — dismissing an alert has
 * to hide it before the round trip finishes, or the seller clicks twice.
 */

/**
 * The tabs an alert may point at.
 *
 * A map rather than a template, so a `tab` the backend invents that this build
 * does not have loses its link instead of navigating a seller to a 404. That
 * happens for real: the backend is deployed separately, and a detector for a
 * Finance tab will exist before the Finance tab does.
 */
const TABS: Record<string, { pathname: string; label: string }> = {
  orders: { pathname: "/orders", label: "Open Orders" },
  inventory: { pathname: "/inventory", label: "Open Inventory" },
  channels: { pathname: "/channels", label: "Open Channels" },
};

export type AlertTarget = {
  href: { pathname: string; query: Record<string, string> };
  label: string;
};

/** Where this alert leads, or null when this build has no such tab. */
export function alertTarget(alert: HomeAlert): AlertTarget | null {
  const tab = TABS[alert.tab];
  if (!tab) return null;
  return {
    href: { pathname: tab.pathname, query: alert.query ?? {} },
    label: tab.label,
  };
}

/**
 * The three tones, and nothing more.
 *
 * Same discipline as the flag chips: the bright value drives the rule down the
 * side, the `-ink` carries every word, and each alert spells out what it means
 * — so the colour is a way of ranking three alerts at a glance rather than the
 * only thing saying which one matters.
 */
export type AlertStyle = {
  /** The card. A soft ground and its own border, on paper. */
  card: string;
  /** The 3px rule down the leading edge, in the bright value. */
  rule: string;
  /** Every word in the card. */
  ink: string;
  /** Read out in place of the colour. */
  srLabel: string;
};

const STYLES: Record<HomeAlert["tone"], AlertStyle> = {
  alert: {
    card: "border-alert/30 bg-alert-soft",
    rule: "bg-alert",
    ink: "text-alert-ink",
    srLabel: "Urgent",
  },
  warn: {
    card: "border-warn/40 bg-warn-soft",
    rule: "bg-warn",
    ink: "text-warn-ink",
    srLabel: "Worth a look",
  },
  // The brand's own note rather than a fourth hue — the blue plate the design
  // system reserves for exactly this.
  info: {
    card: "border-highlight-400 bg-highlight-100",
    rule: "bg-highlight-500",
    ink: "text-primary-600",
    srLabel: "For information",
  },
};

export function alertStyle(tone: HomeAlert["tone"]): AlertStyle {
  return STYLES[tone] ?? STYLES.info;
}
