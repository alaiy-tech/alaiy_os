"use client";

import { format as formatDate, parseISO } from "date-fns";
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
import { cn } from "@/utils";
import { formatCurrency } from "@/utils/format";

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

/** Maps a series' own `field` to a chart-wide colour override - lets an
 * author define a field->colour palette once, in `props`, instead of
 * repeating `color` on every `series` entry. Genuinely generic across every
 * `os-chart` (a plain field->CSS-colour-string lookup, nothing chart- or
 * metric-specific) - a colour can be any valid CSS colour (`"rgb(37 99
 * 235)"`, `"#2563eb"`, a `var(--...)` token), not just a semantic token, so
 * a chart can use a more expressive palette than the rest of the UI without
 * fighting DESIGN.md's "never hard-code a colour" rule for interactive
 * chrome. Entirely optional - a field with no entry here (and no inline
 * `series[].color`) still falls back to `DEFAULT_COLORS`'s rotation below,
 * unchanged. */
export type ChartColorMap = Record<string, string>;

/** How a series' *numeric values* read on the Y-axis and in the tooltip -
 * the same vocabulary `os-kpi`'s own `format` already uses, so a chart and a
 * KPI card showing the same kind of number stay consistent. Omitted keeps
 * today's plain `toLocaleString()`. */
export type ChartValueFormat = "number" | "currency" | "percent";

/** How the x-axis' own category values (the `group` transform step's `key`,
 * typically a date-shaped string) read as tick labels and the tooltip's
 * heading. `"auto"` (the default) inspects each value's own shape - only a
 * value that actually looks like `YYYY-MM-DD`/`YYYY-MM`/`YYYY` gets
 * reformatted, so a non-date x-axis (e.g. a category name) is untouched
 * without needing an explicit opt-out. Deliberately independent of the
 * `group` step's own `granularity` (which the chart component never sees) -
 * a value's shape alone is enough to infer how to display it. */
export type ChartXAxisFormat = "auto" | "day" | "month" | "year" | "none";

function formatChartValue(
  value: number,
  format: ChartValueFormat | undefined,
  currency: string | undefined,
  precision: number | undefined,
): string {
  if (format === "currency") {
    return formatCurrency(value, {
      currency,
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }
  if (format === "percent") return `${value.toFixed(precision ?? 0)}%`;
  return precision !== undefined
    ? value.toFixed(precision)
    : value.toLocaleString();
}

/** `"2026"` / `"2026-01"` / `"2026-01-15"` only - `truncateDate`'s own
 * output shapes (`transform-engine.ts`), the one convention this needs to
 * recognise. Anything else (a plain category name, a full timestamp) isn't
 * a match, so `formatChartXValue` leaves it exactly as-is. */
function inferDateGranularity(value: string): "day" | "month" | "year" | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "day";
  if (/^\d{4}-\d{2}$/.test(value)) return "month";
  if (/^\d{4}$/.test(value)) return "year";
  return null;
}

function formatChartXValue(
  value: unknown,
  xAxisFormat: ChartXAxisFormat = "auto",
): string {
  const raw = String(value ?? "");
  if (xAxisFormat === "none") return raw;

  const granularity =
    xAxisFormat === "auto" ? inferDateGranularity(raw) : xAxisFormat;
  if (!granularity) return raw;

  const date = parseISO(raw);
  if (Number.isNaN(date.getTime())) return raw;

  switch (granularity) {
    case "day":
      return formatDate(date, "d MMM");
    case "month":
      return formatDate(date, "MMM yyyy");
    case "year":
      return formatDate(date, "yyyy");
    default:
      return raw;
  }
}

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
  colors,
  valueFormat,
  currency,
  precision,
  xAxisFormat,
  rows,
  className,
  legend = false,
  height,
}: {
  title?: string;
  subtitle?: string;
  x: string;
  series: ChartSeries[];
  /** Chart-wide field->colour overrides - checked before each series' own
   * inline `color`, which in turn wins over `DEFAULT_COLORS`'s rotation.
   * See `ChartColorMap`'s doc comment. */
  colors?: ChartColorMap;
  /** How every series' numeric values read on the Y-axis and in the
   * tooltip - see `ChartValueFormat`'s doc comment. Omitted keeps today's
   * plain `toLocaleString()`. */
  valueFormat?: ChartValueFormat;
  /** Only meaningful alongside `valueFormat: "currency"`. */
  currency?: string;
  /** Decimal places for `valueFormat`'s number formatting. */
  precision?: number;
  /** How the x-axis' own values read as tick labels/tooltip heading - see
   * `ChartXAxisFormat`'s doc comment. Defaults to `"auto"` (only reformats a
   * value that's actually date-shaped; anything else passes through
   * unchanged, so this is always safe to leave alone). */
  xAxisFormat?: ChartXAxisFormat;
  /** Optional because an unresolved/unregistered `DataSourceRef` degrades to
   * `undefined`, same as `OsDataTableView`'s `rows` - see that component. */
  rows: Record<string, unknown>[] | undefined;
  className: string;
  height?: number;
  legend?: boolean;
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, index) => [
      s.field,
      {
        label: s.label,
        color:
          colors?.[s.field] ??
          s.color ??
          DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      },
    ]),
  );

  const body =
    !rows || rows.length === 0 ? (
      <div
        className={cn(
          "grid w-full h-full place-items-center rounded-none text-muted-foreground text-sm",
          className,
        )}
      >
        No data available.
      </div>
    ) : (
      <ChartContainer
        config={config}
        // No explicit `height` - fill whatever height this chart's own
        // parent grid cell stretches to (its default grid behavior:
        // `align-items: stretch` gives every row's items equal height), so
        // a chart next to a taller sibling (e.g. a KPI grid) grows to match
        // it instead of getting cropped/gapped at `aspect-video`'s fixed
        // 16:9 ratio. An explicit `height` still wins - `cn` (tailwind-merge)
        // correctly drops `aspect-video`/`h-full` in favor of the inline style.
        className={cn("w-full h-full", !height && "aspect-auto h-full")}
        style={{ height }}
      >
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
            tickFormatter={(value) => formatChartXValue(value, xAxisFormat)}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11 }}
            width={40}
            tickFormatter={(value) =>
              formatChartValue(value, valueFormat, currency, precision)
            }
          />
          <ChartTooltip
            labelFormatter={(value) => formatChartXValue(value, xAxisFormat)}
            content={
              <ChartTooltipContent
                valueFormatter={(value) =>
                  formatChartValue(value, valueFormat, currency, precision)
                }
              />
            }
          />
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
    <Card className={cn(height ? undefined : "h-full", className)}>
      <CardHeader>
        {title && (
          <CardTitle className="font-medium leading-none">{title}</CardTitle>
        )}
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent className={height ? undefined : "min-h-0 flex-1"}>
        {body}
      </CardContent>
    </Card>
  );
}
