"use client";

import { ArrowUpRight, PackageCheck, PackageX, TriangleAlert } from "lucide-react";
import { Label, Pie, PieChart } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import type { StockMix } from "@/types/dashboard";

const gaugeSegmentCount = 32;

const chartConfig = {
  "in-stock": {
    label: "In stock",
    color: "var(--chart-2)",
  },
  "low-stock": {
    label: "Low stock",
    color: "var(--chart-1)",
  },
  "out-of-stock": {
    label: "Out of stock",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

/** Splits the gauge's fixed 32 segments across the three buckets in proportion
 * to their SKU counts. Rounding each bucket independently can over- or
 * under-fill the ring, so out-of-stock takes whatever is left rather than being
 * rounded too. */
function buildGaugeSegments(mix: StockMix, total: number) {
  const inStockSegments = Math.round((mix.in_stock / total) * gaugeSegmentCount);
  const lowStockSegments = Math.round((mix.low_stock / total) * gaugeSegmentCount);

  function statusFor(index: number) {
    if (index < inStockSegments) return "in-stock";
    if (index < inStockSegments + lowStockSegments) return "low-stock";
    return "out-of-stock";
  }

  return Array.from({ length: gaugeSegmentCount }, (_, index) => {
    const status = statusFor(index);
    return {
      fill: `var(--color-${status})`,
      id: `segment-${index + 1}`,
      status,
      value: 1,
    };
  });
}

function InventoryCard({ availablePercent, children }: { availablePercent: string; children: React.ReactNode }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">Inventory</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {availablePercent}
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

/** Presentational - `mix` is fetched server-side in page.tsx (see
 * item-stats.server.ts). Counts are SKUs, not units: "In stock 760" means 760
 * items are stocked above the low-stock threshold. Still a Client Component
 * because the gauge is recharts. */
export function Inventory({ mix }: { mix: StockMix | null }) {
  if (!mix) {
    return (
      <InventoryCard availablePercent="—">
        <p className="text-muted-foreground text-sm">
          Could not load inventory. Make sure you&apos;re signed in and try again.
        </p>
      </InventoryCard>
    );
  }

  const total = mix.in_stock + mix.low_stock + mix.out_of_stock;
  if (total === 0) {
    return (
      <InventoryCard availablePercent="—">
        <p className="text-muted-foreground text-sm">No stock items in the catalog yet.</p>
      </InventoryCard>
    );
  }

  const availablePercent = Math.round((mix.in_stock / total) * 100);
  const gaugeSegments = buildGaugeSegments(mix, total);
  const inventorySummary = [
    { icon: PackageCheck, label: "In stock", value: mix.in_stock },
    { icon: TriangleAlert, label: "Low stock", value: mix.low_stock },
    { icon: PackageX, label: "Out", value: mix.out_of_stock },
  ] as const;

  return (
    <InventoryCard availablePercent={`${availablePercent}% available`}>
      <ChartContainer config={chartConfig} className="mx-auto h-30 w-full">
        <PieChart>
          <Pie
            cx="50%"
            cy="100%"
            cornerRadius={6}
            data={gaugeSegments}
            dataKey="value"
            endAngle={0}
            innerRadius={80}
            outerRadius={110}
            paddingAngle={2}
            startAngle={180}
            stroke="var(--card)"
            strokeWidth={1}
          >
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                      <tspan
                        className="fill-foreground font-medium text-2xl tabular-nums"
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 22}
                      >
                        {availablePercent}%
                      </tspan>
                      <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy || 0) + 38}>
                        Available
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <Separator />

      <div className="grid grid-cols-3 divide-x">
        {inventorySummary.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-3 text-center">
            <div className="grid size-9 place-items-center rounded-full bg-muted">
              <item.icon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-muted-foreground text-xs leading-none">{item.label}</div>
              <div className="font-medium text-sm tabular-nums">{item.value.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </InventoryCard>
  );
}
