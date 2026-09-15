/**
 * The product's own photograph, at the three sizes the product shows it.
 *
 * A seller recognises their catalogue by sight long before they read a SKU, so
 * wherever a channel gives us an image it is the first thing in the row and the
 * largest thing in the panel — the words beside it are the metadata, not the
 * subject. That is the whole reason this exists as a component rather than an
 * `<img>` per call site: the sizes are a decision about how these screens are
 * read, and they have to be the same decision on every one of them.
 *
 * A plain `<img>`, not `next/image`: these are arbitrary third-party hosts —
 * Shopify's CDN, Amazon's image host, whatever a future channel uses — and the
 * optimiser needs every one allow-listed in next.config. An unoptimised image
 * is the right trade for a URL we do not control. Both hosts are public, so no
 * proxy is needed either.
 */

export type ProductImageSize = "row" | "thumb" | "hero";

const SIZES: Record<ProductImageSize, { box: string; label: string }> = {
  /** A table row. 64px — four times the area of the 32px thumbnail this
   *  replaces, which is the difference between a decoration and something a
   *  seller can actually identify a product by while scrolling. */
  row: { box: "h-16 w-16", label: "text-[9px]" },
  /** The rest of a listing's images. Four of these and the gaps between them
   *  come to exactly one row under the main image. */
  thumb: { box: "h-10 w-10", label: "text-[9px]" },
  /** The detail panel's main image. Smaller on a phone, where it is stacked
   *  above the facts rather than beside them and 192px would be most of the
   *  first screen. */
  hero: { box: "h-40 w-40 sm:h-48 sm:w-48", label: "text-[11px]" },
};

export function ProductImage({
  src,
  alt = "",
  size = "row",
  className = "",
}: {
  src?: string | null;
  /**
   * Empty by default, and that is the right answer in a table: the title sits
   * immediately beside it, so an alt text would be the same words read twice.
   * The detail panel passes real text, because there the image is the subject.
   */
  alt?: string;
  size?: ProductImageSize;
  className?: string;
}) {
  const { box, label } = SIZES[size];
  const frame = `${box} shrink-0 rounded-xs border border-line`;

  // Not a rendering failure — a listing with no image is a listing buyers scroll
  // past, and on Amazon it is grounds for suppression. So the gap keeps the
  // image's own footprint and says what is missing, rather than collapsing and
  // letting the row look like every other one.
  if (!src) {
    return (
      <span
        className={`${frame} grid place-items-center bg-surface px-1 text-center font-sans ${label} font-semibold uppercase leading-tight tracking-[0.08em] text-muted-soft ${className}`}
      >
        No image
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      // `cover` in a table and `contain` in the panel, and the two are different
      // jobs rather than an inconsistency. A column of squares all filled to the
      // same edges is what makes a list scannable; the main image on the detail
      // is the artefact being inspected — the thing Amazon judges against its
      // own rules — and cropping it there would show the seller something the
      // buyer never sees.
      className={`${frame} bg-white ${size === "hero" ? "object-contain" : "object-cover"} ${className}`}
    />
  );
}
