"use client";

import { format, parse } from "date-fns";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { CustomerTrendPoint } from "@/types/customers";

const trendConfig = {
  new_customers: {
    label: "New",
    color: "var(--foreground)",
  },
  active_customers: {
    label: "Ordered",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig;

/** The backend labels each point "Aug 25"; the tooltip spells the month out
 * in full rather than repeating the axis tick verbatim. */
function formatTooltipLabel(value: string) {
  const month = parse(value, "MMM yy", new Date());
  return Number.isNaN(month.getTime()) ? value : format(month, "MMMM yyyy");
}

export function CustomerTrend({ points }: { points: CustomerTrendPoint[] }) {
  const hasActivity = points.some((point) => point.new_customers > 0 || point.active_customers > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">Acquisition</CardTitle>
        <CardDescription>
          New customers against those who placed an order, by month over the last 12 months.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasActivity ? (
          <ChartContainer config={trendConfig} className="h-72 w-full">
            <ComposedChart accessibilityLayer data={points} margin={{ bottom: 0, left: 0, right: 0, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="period"
                axisLine={false}
                height={30}
                tick={{ fontSize: 11 }}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickLine={false}
                tickMargin={8}
                width={36}
              />
              <ChartTooltip
                content={<ChartTooltipContent className="w-44" labelFormatter={(v) => formatTooltipLabel(String(v))} />}
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="new_customers"
                fill="var(--color-new_customers)"
                name="New"
                opacity={0.25}
                radius={[6, 6, 0, 0]}
              />
              <Line
                dataKey="active_customers"
                dot={false}
                name="Ordered"
                stroke="var(--color-active_customers)"
                strokeWidth={1.8}
                type="monotone"
                activeDot={{
                  r: 4,
                  fill: "var(--background)",
                  stroke: "var(--color-active_customers)",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <div className="grid h-72 w-full place-items-center text-muted-foreground text-sm">
            No customers or orders in the last 12 months.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
