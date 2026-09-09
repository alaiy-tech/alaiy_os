import type { CoverBand } from "@/lib/inventory/types";

/**
 * Days of cover, and how it reads.
 *
 * The one number on the Inventory tab that is not a stock figure, and the
 * reason the tab exists: three inventory numbers that disagree still do not
 * say when you run out. Cover is stock on hand over sales velocity, and the
 * bands are the spec's.
 *
 * Client-safe. The arithmetic belongs on the server — velocity is order
 * history over a workspace-configured window — but which colour a band gets is
 * presentation, and the legend under the table shares this vocabulary.
 */

export type CoverPresentation = {
  label: string;
  /** The tooltip: what this band means for a reorder decision. */
  blurb: string;
  /** On the cell. The figure is always spelled out beside it. */
  cell: string;
  dot: string;
};

const BANDS: Record<CoverBand, CoverPresentation> = {
  healthy: {
    label: "Comfortable",
    blurb: "More than 30 days at the current rate. Nothing to decide.",
    cell: "text-ok-ink",
    dot: "bg-ok",
  },
  watch: {
    label: "Worth watching",
    blurb: "15 to 30 days. Fine unless a campaign is coming.",
    cell: "text-primary-600",
    dot: "bg-highlight-500",
  },
  low: {
    label: "Reorder now",
    blurb: "8 to 14 days. Inside most suppliers' lead time — a PO should already be open.",
    cell: "text-warn-ink font-semibold",
    dot: "bg-warn",
  },
  critical: {
    label: "About to stock out",
    blurb:
      "Under a week. Expect a stockout, and on Amazon an inactive listing shortly after.",
    cell: "text-alert-ink font-semibold",
    dot: "bg-alert",
  },
  unknown: {
    /**
     * Nothing has sold in the window, so there is no velocity to divide by.
     *
     * Deliberately not zero and deliberately not red. A SKU with 18 units and
     * no sales has infinite cover, not none, and painting it critical would
     * send someone to reorder the one thing they should not.
     */
    label: "No sales yet",
    blurb:
      "Nothing sold in the window, so there is no rate to project from. Not the same as running out.",
    cell: "text-muted",
    dot: "bg-muted/50",
  },
};

export function coverPresentation(band: CoverBand): CoverPresentation {
  return BANDS[band] ?? BANDS.unknown;
}

/** In severity order, for the legend and the filter. */
export const COVER_BANDS: CoverBand[] = ["critical", "low", "watch", "healthy", "unknown"];

export const COVER_FILTER_OPTIONS = [
  { value: "", label: "Any cover" },
  ...COVER_BANDS.map((band) => ({ value: band, label: coverPresentation(band).label })),
];

/**
 * "4 days", or the em dash when there is no rate to project from.
 *
 * Rounded down, because a reorder decision made on 4.9 days rounded to 5 is
 * made a day late.
 */
export function coverLabel(days: number | null): string {
  if (days === null) return "—";
  const whole = Math.floor(days);
  return whole === 1 ? "1 day" : `${whole} days`;
}

/**
 * Where a stock figure came from, per the spec's data-source indicator.
 *
 * Worth a column because the three numbers disagree and which one is the
 * master is a workspace-level decision: with a WMS attached, the warehouse is
 * the master and ERPNext is not.
 */
const SOURCES: Record<string, { label: string; blurb: string }> = {
  wms: { label: "WMS", blurb: "Warehouse management system — the stock master for this workspace." },
  erp: {
    label: "ERP",
    blurb: "ERPNext, used as the stock master because no WMS is configured.",
  },
  shopify: { label: "Shopify", blurb: "Shopify's own inventory level for this product." },
  amazon: { label: "Amazon", blurb: "FBA inventory, as Amazon reports it." },
};

export function sourceLabel(source: string): { label: string; blurb: string } {
  return SOURCES[source] ?? { label: source, blurb: "" };
}
