import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/primitive/badge";
import { Button } from "@/components/primitive/button";
import {
  DETAIL_STICKY_TOP,
  PRODUCT_BASE_PATH,
  STATUS_BADGE_CLASS,
} from "@/constants/products";
import { getItemDetailServer } from "@/lib/frappe/item-detail.server";
import { getCompanyInfo } from "@/lib/frappe/server";
import { getProductStatus, itemGalleryImages } from "@/lib/products";
import { cn } from "@/lib/utils";

import { EditableField } from "./_components/editable-field";
import { ItemCommerceBox } from "./_components/item-commerce-box";
import { ItemGallery } from "./_components/item-gallery";
import { ItemOverview } from "./_components/item-overview";
import { ItemPrices } from "./_components/item-prices";
import { ItemSectionNav } from "./_components/item-section-nav";
import { ItemSpecs } from "./_components/item-specs";
import {
  hasVariantContext,
  ItemVariantPanel,
} from "./_components/item-variants";
import { StockLevels } from "./_components/stock-levels";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const name = decodeURIComponent(id);

  const [detail, company] = await Promise.all([
    getItemDetailServer(name),
    getCompanyInfo(),
  ]);
  if (!detail) notFound();

  const { item } = detail;
  const status = getProductStatus(item);
  // An Item's own figures (valuation, standard rate, stock value) are held in
  // the company's currency — unlike an Item Price row, which carries the
  // currency of the price list it belongs to and is formatted from that.
  const currency = company?.defaultCurrency ?? undefined;
  const gallery = itemGalleryImages(item, detail.variants);
  const canWrite = detail.can_write?.item ?? false;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <EditableField
            item={item.name}
            field="item_name"
            label="Item name"
            kind="text"
            value={item.item_name}
            canWrite={canWrite}
          />
        }
        subtitle={`Item · ${item.item_code}`}
        action={
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={cn("border-0 font-medium", STATUS_BADGE_CLASS[status])}
            >
              {status}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href={PRODUCT_BASE_PATH}>
                <ArrowLeft /> All Products
              </Link>
            </Button>
          </div>
        }
      />

      {/* Three columns from xl: the media (sticky, left), what the item is
       * (middle, natural height), and the commerce panel (sticky, right). Both
       * outer columns row-span the middle column's two rows so they stay put
       * while the description, variants and specifications scroll past them,
       * unsticking only where the grid ends and the full-width stock and
       * pricing tables begin.
       *
       * At lg the commerce panel drops under the middle column's first row
       * rather than squeezing a third track into ~300px, and below lg the whole
       * thing is plain DOM order: media, overview, commerce, sections.
       *
       * Every direct child carries min-w-0. A grid item's automatic minimum size
       * is its min-content width, so one wide descendant (a table, a long
       * unbroken item code) would grow its track past the grid's own width — and
       * the shell clips its horizontal overflow, so that surplus is cut off
       * rather than scrollable. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,300px)]">
        <div
          className={cn(
            "min-w-0 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:self-start xl:row-span-2",
            "lg:sticky",
            DETAIL_STICKY_TOP,
          )}
        >
          <ItemGallery images={gallery} alt={item.item_name} />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-1">
          <ItemOverview item={item} canWrite={canWrite} />
          {hasVariantContext(detail) && (
            <ItemVariantPanel detail={detail} currency={currency} />
          )}
        </div>

        <div
          className={cn(
            "min-w-0 lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:self-start",
            "xl:sticky",
            DETAIL_STICKY_TOP,
          )}
        >
          <ItemCommerceBox
            item={item}
            stock={detail.stock.totals}
            canReadStock={detail.can_read.stock}
            warehouseCount={detail.stock.bins.length}
            currency={currency}
            canWrite={canWrite}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-3 xl:col-start-2 xl:row-start-2">
          {/* <ItemSectionNav /> */}
          <ItemSpecs item={item} currency={currency} canWrite={canWrite} />
        </div>
      </div>

      {/* Full width, outside the grid: eight numeric columns and seven price
       * columns have nowhere to go in a 1fr middle track, and this is where the
       * sticky columns above are meant to let go. */}
      <StockLevels
        stock={detail.stock}
        canRead={detail.can_read.stock}
        isStockItem={Boolean(item.is_stock_item)}
        currency={currency}
      />

      <ItemPrices prices={detail.prices} canRead={detail.can_read.prices} />
    </div>
  );
}
