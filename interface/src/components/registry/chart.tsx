"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/primitive/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/primitive/chart";

/** The `chart` capability contract's series shape (brief §21) - one generic
 * composed chart covering exactly the two shapes this app actually has
 * (bar+area revenue/profit, bar+line new/active customers), not a chart-type
 * enum built out further than anything here needs. */
export type ChartSeriesType = "bar" | "line" | "area";

export type ChartSeries = {
  field: string;
  label: string;
  type: ChartSeriesType;
  color?: string;
};

const DEFAULT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/**
 * The `os-chart` registry entry - fully generic across every page. Built on
 * the existing shadcn `ChartContainer`/`ChartTooltip`/`ChartLegend` and
 * Recharts' `ComposedChart`, the same primitives every chart in this app
 * already used, just parameterized by `x`/`series` instead of hand-written
 * per page. Disclosed simplification: the original dashboard/customers
 * charts' bespoke glow-filter and custom tick-label formatting don't carry
 * over here - visual polish, not part of either chart's data or behavior.
 */
export function OsChart({
  title,
  subtitle,
  x,
  series,
  rows,
  legend = false,
  height = 280,
}: {
  title?: string;
  subtitle?: string;
  x: string;
  series: ChartSeries[];
  /** Optional because an unresolved/unregistered `DataSourceRef` degrades to
   * `undefined`, same as `OsDataTableView`'s `rows` - see that component. */
  rows: Record<string, unknown>[] | undefined;
  legend?: boolean;
  height?: number;
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, index) => [
      s.field,
      {
        label: s.label,
        color: s.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      },
    ]),
  );

  const body =
    !rows || rows.length === 0 ? (
      <div
        className="grid w-full place-items-center text-muted-foreground text-sm"
        style={{ height }}
      >
        No data available.
      </div>
    ) : (
      <ChartContainer config={config} className="w-full" style={{ height }}>
        <ComposedChart
          data={rows}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey={x}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            tickMargin={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            width={40}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          {legend && <ChartLegend content={<ChartLegendContent />} />}
          {series.map((s) => {
            if (s.type === "bar") {
              return (
                <Bar
                  key={s.field}
                  dataKey={s.field}
                  fill={`var(--color-${s.field})`}
                  radius={[4, 4, 0, 0]}
                />
              );
            }
            if (s.type === "line") {
              return (
                <Line
                  key={s.field}
                  dataKey={s.field}
                  stroke={`var(--color-${s.field})`}
                  strokeWidth={2}
                  type="monotone"
                  dot={false}
                />
              );
            }
            return (
              <Area
                key={s.field}
                dataKey={s.field}
                stroke={`var(--color-${s.field})`}
                fill={`var(--color-${s.field})`}
                fillOpacity={0.18}
                type="monotone"
              />
            );
          })}
        </ComposedChart>
      </ChartContainer>
    );

  if (!title && !subtitle) return body;

  return (
    <Card>
      <CardHeader>
        {title && (
          <CardTitle className="font-normal leading-none">{title}</CardTitle>
        )}
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
