import type { KPI_ICONS } from "@/config/kpi-icons";

export type OsChartIconName = keyof typeof KPI_ICONS;
export type OsChartSeriesType = "bar" | "line" | "area";
export type OsChartValueFormat = "number" | "currency" | "percent";
export type OsChartXAxisFormat = "auto" | "day" | "month" | "year" | "none";
export type ChartColorMap = Record<string, string>;
