import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { orderFlags, type FlagTone } from "@/lib/orders/flags";
import type { OrderFlagKey, OrderFlagRules } from "@/lib/backend/types";

/**
 * Table primitives for the Orders and Inventory tabs.
 *
 * Server-safe on purpose. Sorting and paging are links that change the URL, so
 * the server re-renders with new query parameters — there is no client state
 * holding a second copy of the rows, and a sorted, filtered table survives a
 * refresh or being pasted into Slack.
 */

/** Whatever Link accepts. The pages pass the object form, never a built string. */
type Href = ComponentProps<typeof Link>["href"];

export function TableFrame({
  children,
  /**
   * Below this the columns are squeezed past reading, so the wrapper scrolls
   * instead. Set per table from its column count: the Ask panel takes 400px of
   * a 1440px screen, and a table that does not fit what is left hides its last
   * column by default — which for Orders was the money.
   */
  minWidth = "52rem",
}: {
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    // The sideways scroll belongs to the table's own wrapper. On the page it
    // would drag the sidebar and the Ask panel along with it.
    <div className="overflow-x-auto rounded-sm border border-line bg-white">
      {/* `font-data` is Geist: this is the surface a seller scans a thousand
          rows of, and Poppins is wider and looser at 13px. Headings opt back
          into the brand face below. */}
      <table
        style={{ minWidth }}
        className="w-full border-collapse text-left font-data text-[13px]"
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-line bg-surface px-3 py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

/**
 * A sortable column heading.
 *
 * The page builds `href` from its own current query, so this component never
 * needs to know which route it is on or which filters are live. `active` is
 * separate from `direction` because an inactive column still has to show the
 * direction it *would* sort in.
 */
export function SortableTh({
  children,
  href,
  active,
  direction,
  align = "left",
}: {
  children: ReactNode;
  href: Href;
  active: boolean;
  direction: "asc" | "desc";
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={`whitespace-nowrap border-b border-line bg-surface px-3 py-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] ${
        align === "right" ? "text-right" : ""
      } ${active ? "text-primary-600" : "text-primary-500"}`}
    >
      <Link href={href} className="inline-flex items-center gap-1 hover:text-primary-600">
        {children}
        <span aria-hidden className={active ? "" : "opacity-0"}>
          {direction === "asc" ? "↑" : "↓"}
        </span>
      </Link>
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`border-b border-line/60 px-3 py-2.5 align-middle text-ink ${
        align === "right" ? "text-right tabular-nums" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

/**
 * The channel a row came from.
 *
 * A dot plus a pill, matching every other status in the product. The two
 * channels get two distinct hues rather than two shades of one, because
 * telling them apart is the whole job of the column — and the label is still
 * spelled out, so the colour is a shortcut and never the only signal.
 */
export function ChannelBadge({ channel }: { channel: string }) {
  const tones: Record<string, { pill: string; dot: string }> = {
    shopify: {
      pill: "border-ok/30 bg-ok-soft text-ok-ink",
      dot: "bg-ok",
    },
    amazon: {
      pill: "border-warn/40 bg-warn-soft text-warn-ink",
      dot: "bg-warn",
    },
  };
  const tone = tones[channel] ?? { pill: "border-line bg-surface text-muted", dot: "bg-muted/50" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs border px-2 py-0.5 font-sans text-[11px] font-medium capitalize ${tone.pill}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {channel}
    </span>
  );
}

/**
 * A status exactly as a channel reported it.
 *
 * Deliberately not colour-coded by meaning. Shopify's vocabulary and Amazon's
 * do not line up, and Amazon's fulfilment field carries AFN/MFN — its
 * fulfilment *channel*, not a status at all. A green "good" state across the
 * two would assert something neither channel said.
 */
export function StatusText({ value }: { value?: string }) {
  if (!value) return <span className="text-muted">—</span>;
  // Title-cased so SHOPIFY'S SHOUTING sits beside Amazon's "Shipped" without
  // one of them looking like an error — but three-letter codes are left alone,
  // because Amazon's fulfilment channel is AFN and MFN, and "Afn" is not a
  // word anybody would recognise. The raw value stays in the tooltip.
  const words = value.split(/[_\s]+/).map((word) =>
    word.length <= 3 && word === word.toUpperCase()
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
  return <span title={value}>{words.join(" ")}</span>;
}

/**
 * The problem flags on an order.
 *
 * Three hues and never more: the status palette exists so a table can say
 * "this one has gone wrong", and a fourth would start to mean nothing. Each
 * chip spells its state out, so the colour is a shortcut down four hundred
 * rows rather than the only way to read one — which is also why they are
 * legible to anyone who cannot separate the amber from the red.
 *
 * An unflagged order gets an em dash, not an empty cell: a blank there reads
 * as "not loaded" in a column where every other row has something in it.
 */
export function FlagChips({
  flags,
  rules,
}: {
  flags: OrderFlagKey[];
  /** The thresholds these flags were computed with, for the tooltip. */
  rules: OrderFlagRules;
}) {
  const present = orderFlags(flags);
  if (!present.length) return <span className="text-muted-soft">—</span>;

  const tones: Record<FlagTone, string> = {
    alert: "border-alert/40 bg-alert-soft text-alert-ink",
    warn: "border-warn/40 bg-warn-soft text-warn-ink",
    neutral: "border-line bg-surface text-muted",
  };
  const dots: Record<FlagTone, string> = {
    alert: "bg-alert",
    warn: "bg-warn",
    neutral: "bg-muted/50",
  };

  return (
    <span className="flex flex-wrap gap-1">
      {present.map((flag) => (
        <span
          key={flag.key}
          title={flag.explain(rules)}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs border px-2 py-0.5 font-sans text-[11px] font-medium ${tones[flag.tone]}`}
        >
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dots[flag.tone]}`} />
          {flag.label}
        </span>
      ))}
    </span>
  );
}

/** Stands in for the rows when the filters match nothing. */
export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center text-[13px] text-muted">
        {children}
      </td>
    </tr>
  );
}
