/**
 * A rating, as stars and the number both — the glyphs are what makes a
 * column of them scannable, and the number is what makes one legible to a
 * screen reader (and to anyone who cannot tell four stars from five at a
 * glance, the same reasoning as the coloured status dots elsewhere).
 */
export function RatingStars({ value }: { value: number }) {
  const filled = Math.round(value);

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className="text-[13px] leading-none text-highlight-600">
        {Array.from({ length: 5 }, (_, i) => (i < filled ? "★" : "☆")).join("")}
      </span>
      <span className="font-data text-[12.5px] font-medium text-ink">{value.toFixed(1)}</span>
      <span className="sr-only">out of 5</span>
    </span>
  );
}
