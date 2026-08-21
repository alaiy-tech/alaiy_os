import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { formatCurrency } from "@/lib/utils";
import type { ItemPriceRow } from "@/types/products";

import { PageSection } from "./page-section";

/** An Item Price row is a buying price, a selling price, or (rarely) both —
 * the two flags are independent Checks on the doctype, so they are rendered as
 * they are found rather than collapsed into one either/or column. */
function RateTypeBadges({ price }: { price: ItemPriceRow }) {
  const types = [price.buying ? "Buying" : null, price.selling ? "Selling" : null].filter(Boolean) as string[];
  if (!types.length) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {types.map((type) => (
        <Badge key={type} variant="outline" className="border-0 bg-muted font-normal text-xs">
          {type}
        </Badge>
      ))}
    </div>
  );
}

/** Who the price is for, when it is pinned to one party. Item Price carries
 * both a customer and a supplier link and uses at most one of them.
 *
 * Tested for content rather than for null: Frappe hands back `""` for an unset
 * Link field, which `??` would treat as a value and print as a blank party. */
function partyOf(price: ItemPriceRow): string | null {
  if (price.customer?.trim()) return price.customer;
  if (price.supplier?.trim()) return price.supplier;
  return null;
}

export function ItemPrices({ prices, canRead }: { prices: ItemPriceRow[]; canRead: boolean }) {
  return (
    <PageSection
      id="item-pricing"
      title="Pricing"
      meta={canRead ? `${prices.length} ${prices.length === 1 ? "price" : "prices"}` : "Not shown"}
    >
      {!canRead ? (
        <p className="text-muted-foreground text-sm">You don&apos;t have permission to view item prices.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table className="w-full **:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
            <TableHeader>
              <TableRow>
                <TableHead className="py-3 font-medium">Price List</TableHead>
                <TableHead className="py-3 font-medium">Type</TableHead>
                <TableHead className="py-3 font-medium">Party</TableHead>
                <TableHead className="py-3 font-medium">UOM</TableHead>
                <TableHead className="py-3 font-medium">Valid From</TableHead>
                <TableHead className="py-3 font-medium">Valid Upto</TableHead>
                <TableHead className="py-3 text-right font-medium">Rate</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {prices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No price is set for this item.
                  </TableCell>
                </TableRow>
              ) : (
                prices.map((price) => (
                  <TableRow key={price.name} className="border-border/60">
                    <TableCell className="py-3 font-medium">{price.price_list}</TableCell>
                    <TableCell className="py-3">
                      <RateTypeBadges price={price} />
                    </TableCell>
                    <TableCell className="py-3">
                      {partyOf(price) ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-3">
                      {price.uom ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="py-3">{formatDate(price.valid_from)}</TableCell>
                    <TableCell className="py-3">{formatDate(price.valid_upto)}</TableCell>
                    {/* Each row is priced in its own price list's currency, so
                     * the company default is never substituted here. */}
                    <TableCell className="py-3 text-right font-medium tabular-nums">
                      {formatCurrency(price.price_list_rate ?? 0, { currency: price.currency ?? undefined })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </PageSection>
  );
}
