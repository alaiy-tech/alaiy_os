import type { ProductRow } from "@/types/products";

import { ImageCarousel } from "./image-carousel";

// 6 cards per row at the xl breakpoint (see constants/products.ts's
// GRID_CARDS_PER_ROW) - Tailwind needs the literal class here, this is just
// the number that class encodes.
export function ProductGrid({ rows, isLoading }: { rows: ProductRow[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="px-4 py-12 text-center text-muted-foreground text-sm">Loading products…</div>;
  }

  if (rows.length === 0) {
    return <div className="px-4 py-12 text-center text-muted-foreground text-sm">No results.</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {rows.map((row) => (
        <div key={row.name} className="flex flex-col overflow-hidden rounded-lg border bg-card">
          {/* Item only carries a single `image` field in stock ERPNext - this
           * renders as a single-slide carousel until the backend also
           * exposes a gallery of attached files for an item. */}
          <ImageCarousel images={row.image ? [row.image] : []} alt={row.item_name} />
          <div className="flex flex-col gap-0.5 p-3">
            <span className="truncate font-medium text-sm" title={row.item_name}>
              {row.item_name}
            </span>
            <span className="truncate text-muted-foreground text-xs" title={row.item_group}>
              {row.item_group}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
