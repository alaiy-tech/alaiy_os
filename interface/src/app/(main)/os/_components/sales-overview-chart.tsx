"use client";

import { format, parse } from "date-fns";
import { Area, Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";
import type { SalesTrendPoint } from "@/types/dashboard";

const revenueOverviewConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--foreground)",
  },
  profit: {
    label: "Profit",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig;

/** The x axis labels only the middle bucket of each month, so twelve months of
 * six buckets read as twelve month names instead of 72 crowded ticks. */
function formatMonthTick(value: string) {
  const parts = value.split(" ");
  const range = parts.at(-1);
  const month = parts.slice(0, -1).join(" ");

  return range === "11-15" ? month : "";
}

function formatTooltipLabel(value: string) {
  const parts = value.split(" ");
  const range = parts.at(-1);
  const month = parse(parts.slice(0, -1).join(" "), "MMM yy", new Date());
  const [start, end] = String(range).split("-");
  const lastDayOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startDate = new Date(month.getFullYear(), month.getMonth(), Number(start));
  const endDate = new Date(month.getFullYear(), month.getMonth(), Math.min(Number(end), lastDayOfMonth));

  return `${format(month, "MMM")} ${format(startDate, "do")} - ${format(endDate, "do")}, ${format(month, "yyyy")}`;
}

/** Revenue and profit share the x axis but not the y: revenue rides the top of
 * the plot as a line and profit sits underneath as short bars. With hardcoded
 * sample data those bands were fixed pixel-ranges; on real data they have to be
 * derived, or a site whose figures are 100x larger draws a flat line. The
 * revenue floor is pulled below its own minimum so the line has somewhere to
 * dip, and the profit ceiling is doubled so its bars stay in the lower half. */
function axisDomains(points: SalesTrendPoint[]) {
  const revenues = points.map((point) => point.revenue);
  const profits = points.map((point) => point.profit);

  const maxRevenue = Math.max(...revenues, 0);
  const minRevenue = Math.min(...revenues, maxRevenue);
  const maxProfit = Math.max(...profits, 0);
  const minProfit = Math.min(...profits, 0);

  return {
    revenue: [minRevenue - (maxRevenue - minRevenue) * 0.8 - 1, maxRevenue * 1.05 + 1] as [number, number],
    profit: [Math.min(minProfit * 1.1, 0), maxProfit * 2 + 1] as [number, number],
  };
}

export function SalesOverviewChart({
  points,
  defaultCurrency,
}: {
  points: SalesTrendPoint[];
  defaultCurrency?: string;
}) {
  if (points.length === 0) {
    return (
      <div className="grid h-74 w-full place-items-center text-muted-foreground text-sm">
        No sales in the last 12 months.
      </div>
    );
  }

  const domains = axisDomains(points);
  const formatMoney = (value: unknown) =>
    typeof value === "number"
      ? formatCurrency(value, { currency: defaultCurrency, noDecimals: true })
      : String(value ?? "");

  return (
    <ChartContainer config={revenueOverviewConfig} className="h-74 w-full">
      <ComposedChart accessibilityLayer data={points} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
        <defs>
          <filter id="sales-line-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feFlood floodColor="var(--color-revenue)" floodOpacity="0.35" />
            <feComposite in2="blur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid yAxisId="profit" vertical={false} />
        <XAxis
          dataKey="period"
          axisLine={false}
          height={30}
          interval={0}
          minTickGap={0}
          tick={{ fontSize: 10 }}
          tickLine={false}
          tickMargin={8}
          tickFormatter={(value) => formatMonthTick(String(value))}
        />
        <YAxis yAxisId="revenue" hide domain={domains.revenue} />
        <YAxis yAxisId="profit" hide domain={domains.profit} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              className="w-48"
              labelFormatter={(value) => formatTooltipLabel(String(value))}
              formatter={(value, name, item) => (
                <>
                  <div
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{
                      backgroundColor: item.color,
                    }}
                  />
                  <div className="flex flex-1 items-center justify-between leading-none">
                    <span className="text-muted-foreground">{String(name ?? "")}</span>
                    <span className="font-medium font-mono text-foreground tabular-nums">{formatMoney(value)}</span>
                  </div>
                </>
              )}
            />
          }
          cursor={{
            stroke: "var(--border)",
            strokeDasharray: "4 4",
          }}
        />
        <Bar
          yAxisId="profit"
          barSize={4}
          dataKey="profit"
          fill="var(--color-profit)"
          name="Profit"
          opacity={0.18}
          radius={[6, 6, 0, 0]}
        />
        <Area
          yAxisId="revenue"
          dataKey="revenue"
          fill="none"
          filter="url(#sales-line-glow)"
          name="Revenue"
          stroke="var(--color-revenue)"
          strokeWidth={1.8}
          type="linear"
          activeDot={{
            r: 4,
            fill: "var(--background)",
            stroke: "var(--color-revenue)",
            strokeWidth: 2,
          }}
          dot={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
