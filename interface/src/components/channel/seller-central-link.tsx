import Image from "next/image";
import type { ReactNode } from "react";
import sellerCentralMark from "../../../public/seller-central.webp";
import type { ChannelId } from "@/lib/backend/types";

/**
 * The way out of Alaiy and into the channel.
 *
 * Alaiy is where a seller reads; every action they can take still happens on
 * the channel. So wherever a screen shows something with a counterpart over
 * there, it carries one of these — the same mark, in the same place, meaning
 * the same thing on every tab. That sameness is the point: a link that is a
 * logo here, a button there and a sentence somewhere else is three things to
 * learn, and a seller who has to hunt for it goes to their Seller Central
 * bookmark instead and stops coming back.
 *
 * **The URL is never built here.** It arrives on the row or the page payload,
 * assembled by `selfserve/channel_links.py` from the shop domain or the
 * marketplace on the connection — neither of which reaches the browser. A null
 * href is therefore a real answer ("that connection cannot tell us where this
 * lives") and renders nothing, rather than a link onto a 404.
 */

/** Amazon's mark, at the size the thing it sits beside is set in. */
const SIZES = {
  sm: "h-3.5 w-3.5",
  md: "h-[1.05rem] w-[1.05rem]",
} as const;

export type MarkSize = keyof typeof SIZES;

/**
 * The mark on its own.
 *
 * Exported because the Orders panel wants it inside its press button rather
 * than beside it — that screen's way out is a full-width call to action, not a
 * glyph in a row. One image, one size scale, so the thing a seller learns to
 * look for is the same shape everywhere it appears.
 *
 * Always `aria-hidden`: whatever it sits in carries the words.
 */
export function SellerCentralMark({ size = "sm" }: { size?: MarkSize }) {
  return (
    <Image
      src={sellerCentralMark}
      alt=""
      aria-hidden
      className={`${SIZES[size]} shrink-0 object-contain`}
    />
  );
}

export function SellerCentralLink({
  href,
  label,
  size = "sm",
  className = "",
  children,
}: {
  /** Null when the backend could not build one. Renders nothing. */
  href?: string | null;
  /**
   * The accessible name, in full — "Open order 203-… in Seller Central".
   *
   * Always spelled out even when the words are on screen, because what is on
   * screen is "Seller Central" and the thing that makes the link worth
   * following is *which* page it lands on.
   */
  label: string;
  size?: MarkSize;
  className?: string;
  /** Optional words beside the mark, where the tab has room to name it once. */
  children?: ReactNode;
}) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xs text-[12px] text-primary-600 transition-colors hover:bg-primary-600/5 ${
        children ? "px-1.5 py-1" : "p-1"
      } ${className}`}
    >
      {/* The mark carries the meaning visually and `aria-label` carries it to
          a reader; an alt as well would announce the link twice. */}
      <SellerCentralMark size={size} />
      {children}
    </a>
  );
}

/**
 * The same link, on a screen that is not Amazon-only.
 *
 * Orders, Listings and Inventory are per-channel, and only Amazon has a mark
 * here. Rather than leave Shopify rows with nothing, this keeps the words the
 * two tabs already used — the channel's own name for its admin is what a
 * seller is scanning their browser tabs for.
 */
export function ChannelAdminLink({
  channel,
  href,
  label,
  size = "sm",
  className = "",
  children,
}: {
  channel: ChannelId;
  href?: string | null;
  label: string;
  size?: MarkSize;
  className?: string;
  children?: ReactNode;
}) {
  if (!href) return null;

  if (channel === "amazon") {
    return (
      <SellerCentralLink href={href} label={label} size={size} className={className}>
        {children}
      </SellerCentralLink>
    );
  }

  // No mark for Shopify, so the arrow is the indicator and `aria-label` is the
  // meaning. Bare in a table cell, where a row has no room for words, and
  // wearing the channel's own name for its admin wherever there is room.
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center gap-1 rounded-xs py-1 text-[12px] text-primary-600 underline-offset-2 transition-colors hover:bg-primary-600/5 hover:underline ${
        children ? "px-1.5" : "px-1"
      } ${className}`}
    >
      {children}
      <span aria-hidden>↗</span>
    </a>
  );
}
