import type { ChannelListing, LinkMethod, ListingHealth } from "@/lib/product-groups/types";

/**
 * How listing health and product links read.
 *
 * Client-safe, and the same split as `lib/orders/flags.ts`: whether a listing
 * is suppressed is the channel's fact, what the seller is told about it is
 * ours. Three hues and never a fourth, each with its state spelled out — the
 * colour ranks a table of two hundred products at a glance, and is never the
 * only way to read one.
 */

export type HealthPresentation = {
  label: string;
  /** The one-line explanation, for the tooltip and the detail column. */
  blurb: string;
  pill: string;
  dot: string;
  ink: string;
};

const HEALTH: Record<ListingHealth, HealthPresentation> = {
  live: {
    label: "Live",
    blurb: "Listed, active and with nothing flagged against it.",
    pill: "border-ok/30 bg-ok-soft text-ok-ink",
    dot: "bg-ok",
    ink: "text-ok-ink",
  },
  warning: {
    label: "Needs work",
    blurb:
      "Live, but thin: missing bullet points, too few images, or a description the channel will rank poorly.",
    pill: "border-warn/40 bg-warn-soft text-warn-ink",
    dot: "bg-warn",
    ink: "text-warn-ink",
  },
  suppressed: {
    label: "Suppressed",
    blurb: "Not buyable. The channel has taken it down or made it inactive.",
    pill: "border-alert/40 bg-alert-soft text-alert-ink",
    dot: "bg-alert",
    ink: "text-alert-ink",
  },
};

export function healthPresentation(health: ListingHealth): HealthPresentation {
  return HEALTH[health] ?? HEALTH.warning;
}

/** The filter's options, in severity order — the reason to come here is red. */
export const HEALTH_FILTER_OPTIONS = [
  { value: "", label: "Any health" },
  { value: "suppressed", label: "Suppressed" },
  { value: "warning", label: "Needs work" },
  { value: "live", label: "Live" },
];

/**
 * How a product's two listings came to be treated as one product.
 *
 * Shown on the row because it is the difference between a fact and a guess: a
 * barcode match is certain, an AI-suggested one was confirmed by a person, and
 * a seller looking at a merged product deserves to know which.
 */
export type LinkPresentation = { label: string; blurb: string; tone: "neutral" | "accent" };

const LINKS: Record<LinkMethod, LinkPresentation> = {
  barcode: {
    label: "Barcode",
    blurb: "Matched automatically: the same barcode on both channels. No guesswork.",
    tone: "neutral",
  },
  ai_suggested: {
    label: "Suggested",
    blurb:
      "No barcode on both sides, so the titles and descriptions were compared and someone confirmed the match.",
    tone: "accent",
  },
  manual: {
    label: "Linked by hand",
    blurb: "Someone picked this match themselves.",
    tone: "neutral",
  },
  exclusive: {
    label: "One channel only",
    blurb:
      "Sold on a single channel on purpose — an Amazon-only bundle, say. Not a missing link.",
    tone: "neutral",
  },
};

export function linkPresentation(method: LinkMethod): LinkPresentation {
  return LINKS[method] ?? LINKS.manual;
}

/**
 * What is thin about a listing, in the words a seller would use.
 *
 * Derived here rather than sent by the channel: Amazon and Shopify both report
 * a listing as simply active, and "active with two images" is our judgement
 * about how it will perform, not theirs. Saying which of these is the reason
 * for a yellow badge is the difference between a colour and an instruction.
 */
export function listingWeaknesses(listing: ChannelListing): string[] {
  const notes: string[] = [];

  if (listing.images.length === 0) notes.push("no images");
  else if (listing.images.length < 4) {
    notes.push(`only ${listing.images.length} image${listing.images.length === 1 ? "" : "s"}`);
  }

  // Bullets are an Amazon field; Shopify has no equivalent, so their absence
  // there is not a weakness and must not be reported as one.
  if (listing.channel === "amazon") {
    const bullets = listing.bullets?.length ?? 0;
    if (bullets === 0) notes.push("no bullet points");
    else if (bullets < 5) notes.push(`${bullets} of 5 bullet points`);
  }

  const description = (listing.description ?? "").trim();
  if (!description) notes.push("no description");
  else if (description.length < 80) notes.push("a very short description");

  return notes;
}

/**
 * The channels a product group has, and the ones it does not.
 *
 * Returned as a fixed pair so the table's two status columns line up down the
 * page: a group with no Amazon listing leaves that column empty rather than
 * shifting its Shopify status into Amazon's place.
 */
export function byChannel(listings: ChannelListing[]) {
  return {
    shopify: listings.find((l) => l.channel === "shopify"),
    amazon: listings.find((l) => l.channel === "amazon"),
  };
}
