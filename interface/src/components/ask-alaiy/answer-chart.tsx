"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { BarChart3, Download, Table2 } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useCompany } from "@/stores/company/company-provider";
import {
  MAX_PIE_SLICES, parseChartSpec, resolveType, slug, toRows, toTable, type ChartSpec,
} from "./chart-spec";

/** Reads fine on both light and dark -- the same series any recharts card
 * elsewhere in this app could use, kept local here rather than importing a
 * dashboard-specific palette this widget shouldn't depend on. */
const SERIES = ["var(--color-primary)", "var(--color-success)", "var(--color-warning)", "var(--color-destructive)"];

function downloadCsv(filename: string, rows: (string | number | null)[][]): void {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** One chart the model asked for, inside a chat reply. See chart-spec.ts for
 * the ```alaiy-chart fence convention this parses. */
export function AnswerChart({ raw }: { raw: string }) {
  const spec = useMemo(() => parseChartSpec(raw), [raw]);
  const [view, setView] = useState<"chart" | "table">("chart");
  const { defaultCurrency } = useCompany();

  if (!spec) return <ChartFallback raw={raw} />;
  const kind = resolveType(spec);
  const table = toTable(spec);

  return (
    <figure className="my-2 rounded-lg border border-border bg-card p-2.5">
      <div className="mb-1.5 flex items-start gap-2">
        <figcaption className="min-w-0 flex-1 text-xs font-medium leading-snug text-foreground">
          {spec.title || "Chart"}
        </figcaption>
        <div className="flex flex-none items-center gap-0.5">
          <IconToggle active={view === "chart"} label="Chart view" onClick={() => setView("chart")} icon={<BarChart3 className="size-3.5" />} />
          <IconToggle active={view === "table"} label="Table view" onClick={() => setView("table")} icon={<Table2 className="size-3.5" />} />
          {view === "table" && (
            <IconToggle
              label="Download as CSV"
              onClick={() => downloadCsv(`${slug(spec.title)}.csv`, [table.header, ...table.rows.map((row) => row.map((cell) => (cell === null ? "" : cell)))])}
              icon={<Download className="size-3.5" />}
            />
          )}
        </div>
      </div>

      {view === "chart" ? <Plot spec={spec} kind={kind} currency={defaultCurrency} /> : <SpecTable spec={spec} currency={defaultCurrency} />}

      {spec.series.length > 1 && <Legend spec={spec} />}

      {spec.truncated ? (
        <p className="mt-1.5 text-[10.5px] text-muted-foreground">
          Showing the first {spec.labels.length} of {spec.labels.length + spec.truncated} points.
        </p>
      ) : null}
    </figure>
  );
}

export function ChartFallback({ raw }: { raw: string }) {
  return (
    <div className="my-2 rounded-lg border border-border bg-muted/40 p-2.5">
      <p className="mb-1.5 text-[11.5px] text-muted-foreground">Couldn&apos;t draw this chart.</p>
      <pre className="overflow-x-auto text-[11px] leading-relaxed text-foreground"><code>{raw}</code></pre>
    </div>
  );
}

function Plot({ spec, kind, currency }: { spec: ChartSpec; kind: "bar" | "line" | "pie"; currency: string }) {
  const rows = toRows(spec);
  const tick = { fontSize: 10, fill: "var(--color-muted-foreground)" };
  const grid = "var(--color-border)";
  const compact = (value: number) => short(value, spec.unit, currency);
  const full = (value: unknown) => long(value, spec.unit, currency);

  if (kind === "pie") {
    const slices = spec.labels.slice(0, MAX_PIE_SLICES).map((label, index) => ({ name: label, value: spec.series[0].points[index] ?? 0 }));
    return (
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="84%" paddingAngle={2}>
            {slices.map((_, index) => <Cell key={index} fill={SERIES[index % SERIES.length]} />)}
          </Pie>
          <Tooltip formatter={full} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (kind === "line") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={clip} />
          <YAxis tick={tick} tickLine={false} axisLine={false} width={48} tickFormatter={compact} />
          <Tooltip formatter={full} />
          {spec.series.map((series, index) => (
            <Line key={series.name} type="monotone" dataKey={series.name} stroke={SERIES[index % SERIES.length]} strokeWidth={2} dot={false} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  const horizontal = spec.labels.length > 8;
  return (
    <ResponsiveContainer width="100%" height={horizontal ? Math.max(200, spec.labels.length * 26) : 200}>
      <BarChart data={rows} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, bottom: 0, left: horizontal ? 0 : -10 }}>
        <CartesianGrid stroke={grid} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={tick} tickLine={false} axisLine={false} tickFormatter={compact} />
            <YAxis type="category" dataKey="label" tick={tick} tickLine={false} axisLine={false} width={100} interval={0} tickFormatter={clip} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" tickFormatter={clip} />
            <YAxis tick={tick} tickLine={false} axisLine={false} width={48} tickFormatter={compact} />
          </>
        )}
        <Tooltip formatter={full} />
        {spec.series.map((series, index) => (
          <Bar key={series.name} dataKey={series.name} fill={SERIES[index % SERIES.length]} radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function Legend({ spec }: { spec: ChartSpec }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      {spec.series.map((series, index) => (
        <span key={series.name} className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="size-2 flex-none rounded-xs" style={{ background: SERIES[index % SERIES.length] }} />
          {series.name}
        </span>
      ))}
    </div>
  );
}

function SpecTable({ spec, currency }: { spec: ChartSpec; currency: string }) {
  const { header, rows } = toTable(spec);
  return (
    <div className="ask-alaiy-table-wrap max-h-60 overflow-y-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>{header.map((cell, index) => <th key={index} className="border border-border bg-muted px-2 py-1 text-left font-semibold">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-border px-2 py-1">
                  {cellIndex === 0 ? cell : cell === null ? "—" : long(cell, spec.unit, currency)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IconToggle({ icon, label, onClick, active }: { icon: ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={cn("flex size-6 items-center justify-center rounded-md", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}
    >
      {icon}
    </button>
  );
}

function short(value: number, unit: ChartSpec["unit"], currency: string): string {
  if (unit === "currency") return formatCurrency(value, { currency, noDecimals: true });
  if (unit === "percent") return `${value}%`;
  return Math.abs(value) >= 10_000
    ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value)
    : new Intl.NumberFormat().format(value);
}

function long(value: unknown, unit: ChartSpec["unit"], currency: string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  if (unit === "currency") return formatCurrency(n, { currency });
  if (unit === "percent") return `${n}%`;
  return new Intl.NumberFormat().format(n);
}

function clip(value: unknown): string {
  const text = String(value ?? "");
  return text.length > 12 ? `${text.slice(0, 11)}…` : text;
}
