import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRODUCT_BASE_PATH, STATUS_BADGE_CLASS } from "@/constants/products";
import { getItemDetailServer } from "@/lib/frappe/item-detail.server";
import { getCompanyInfo } from "@/lib/frappe/server";
import { getProductStatus } from "@/lib/products";
import { cn } from "@/lib/utils";

import { ItemPrices } from "./_components/item-prices";
import { hasItemRelations, ItemRelations } from "./_components/item-relations";
import { ItemSummary } from "./_components/item-summary";
import { StockLevels } from "./_components/stock-levels";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const name = decodeURIComponent(id);

  const [detail, company] = await Promise.all([getItemDetailServer(name), getCompanyInfo()]);
  if (!detail) notFound();

  const { item } = detail;
  const status = getProductStatus(item);
  // An Item's own figures (valuation, standard rate, stock value) are held in
  // the company's currency — unlike an Item Price row, which carries the
  // currency of the price list it belongs to and is formatted from that.
  const currency = company?.defaultCurrency ?? undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={item.item_name}
        subtitle={item.item_code}
        action={
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={cn("border-0 font-medium", STATUS_BADGE_CLASS[status])}>
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className={hasItemRelations(detail) ? "xl:col-span-7" : "xl:col-span-12"}>
          <ItemSummary item={item} currency={currency} />
        </div>
        {hasItemRelations(detail) && (
          <div className="xl:col-span-5">
            <ItemRelations detail={detail} currency={currency} />
          </div>
        )}
      </div>

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
