import { ArrowUpRight } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import type { TopProductCategory, TopProductsOverview } from "@/types/dashboard";

/** Category colours come from the chart palette in listed (descending) order;
 * the "Other" remainder stays muted so it never reads as a real category. */
const CATEGORY_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"] as const;

function categoryColor(category: TopProductCategory, index: number): string {
  return category.is_other ? "var(--muted-foreground)" : CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Top Products</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          —
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}

/** Pure presentational Server Component - `overview` is fetched server-side in
 * page.tsx (see dashboard-stats.server.ts) and handed down already resolved.
 * `defaultCurrency` is the org's default currency, resolved by the caller. */
export function TopProducts({
  overview,
  defaultCurrency,
}: {
  overview: TopProductsOverview | null;
  defaultCurrency?: string;
}) {
  if (!overview) {
    return <EmptyState message="Could not load top products. Make sure you're signed in and try again." />;
  }

  if (overview.products.length === 0) {
    return <EmptyState message="No sales in this period." />;
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Top Products</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {overview.top_share.toFixed(0)}% of sales
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div aria-label="Sales by category" className="flex h-2 gap-1 overflow-hidden bg-muted" role="img">
            {overview.categories.map((category, index) => (
              <div
                aria-hidden="true"
                key={category.name}
                className="rounded-md"
                style={{
                  backgroundColor: categoryColor(category, index),
                  width: `${category.share}%`,
                }}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            {overview.categories.map((category, index) => (
              <div className="flex items-center gap-1" key={category.name}>
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: categoryColor(category, index) }}
                />
                <span className="text-muted-foreground text-xs">{category.name}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-3">
          <div className="text-muted-foreground text-xs">Products</div>
          <div className="text-muted-foreground text-xs">Share</div>
          <div className="text-muted-foreground text-xs">Sales</div>

          {overview.products.map((product) => (
            <div className="contents text-sm" key={product.item_code}>
              <div className="min-w-0">
                <div className="truncate font-medium">{product.item_name}</div>
                <div className="text-muted-foreground text-xs">{product.category}</div>
              </div>
              <div className="self-center text-muted-foreground tabular-nums">{product.share.toFixed(0)}%</div>
              <div className="self-center font-medium tabular-nums">
                {formatCurrency(product.amount, { currency: defaultCurrency, noDecimals: true })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
