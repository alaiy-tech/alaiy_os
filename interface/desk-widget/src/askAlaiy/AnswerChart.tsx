import { useMemo, useState, type ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { BarChart3, Download, Table2 } from "lucide-react";
import { SERIES, inr, inrCompact, num, pct, cn, downloadCsv } from "./utils";
import {
  MAX_PIE_SLICES, parseChartSpec, resolveType, slug, toRows, toTable, type ChartSpec,
} from "./chartSpec";

/**
 * One chart the model asked for, inside a chat reply. Ported from the
 * alaiy_os_globali reference, minus its PNG export (kept scope to what a
 * first version of this widget in alaiy_os core needs) and its dashboard
 * chart-card reuse, which doesn't exist here.
 */
export function AnswerChart({ raw }: { raw: string }) {
  const spec = useMemo(() => parseChartSpec(raw), [raw]);
  const [view, setView] = useState<"chart" | "table">("chart");

  if (!spec) return <ChartFallback raw={raw} />;
  const kind = resolveType(spec);
  const table = toTable(spec);

  return (
    <figure className="ask-alaiy-chart">
      <div className="ask-alaiy-chart-head">
        <figcaption className="ask-alaiy-chart-title">{spec.title || "Chart"}</figcaption>
        <div className="ask-alaiy-chart-actions">
          <IconToggle
            active={view === "chart"}
            label="Chart view"
            onClick={() => setView("chart")}
            icon={<BarChart3 size={14} />}
          />
          <IconToggle
            active={view === "table"}
            label="Table view"
            onClick={() => setView("table")}
            icon={<Table2 size={14} />}
          />
          {view === "table" && (
            <IconToggle
              label="Download as CSV"
              onClick={() =>
                downloadCsv(`${slug(spec.title)}.csv`, [
                  table.header,
                  ...table.rows.map((row) => row.map((cell) => (cell === null ? "" : cell))),
                ])
              }
              icon={<Download size={14} />}
            />
          )}
        </div>
      </div>

      {view === "chart" ? <Plot spec={spec} kind={kind} /> : <SpecTable spec={spec} />}

      {spec.series.length > 1 && <Legend spec={spec} />}

      {spec.truncated ? (
        <p className="ask-alaiy-chart-note">
          Showing the first {spec.labels.length} of {spec.labels.length + spec.truncated} points.
        </p>
      ) : null}
    </figure>
  );
}

export function ChartFallback({ raw }: { raw: string }) {
  return (
    <div className="ask-alaiy-chart-fallback">
      <p>Couldn't draw this chart.</p>
      <pre><code>{raw}</code></pre>
    </div>
  );
}

function Plot({ spec, kind }: { spec: ChartSpec; kind: "bar" | "line" | "pie" }) {
  const rows = toRows(spec);
  const tick = { fontSize: 10, fill: "var(--text-muted, #8d99a6)" };
  const grid = "var(--border-color, #e0e0e0)";
  const compact = (value: number) => short(value, spec.unit);
  const full = (value: unknown) => long(value, spec.unit);

  if (kind === "pie") {
    const slices = spec.labels.slice(0, MAX_PIE_SLICES).map((label, index) => ({
      name: label,
      value: spec.series[0].points[index] ?? 0,
    }));
    return (
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={slices} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="84%" paddingAngle={2}>
            {slices.map((_, index) => (
              <Cell key={index} fill={SERIES[index % SERIES.length]} />
            ))}
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
            <Line
              key={series.name} type="monotone" dataKey={series.name}
              stroke={SERIES[index % SERIES.length]} strokeWidth={2} dot={false} connectNulls={false}
            />
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
    <div className="ask-alaiy-chart-legend">
      {spec.series.map((series, index) => (
        <span key={series.name}>
          <span className="ask-alaiy-chart-swatch" style={{ background: SERIES[index % SERIES.length] }} />
          {series.name}
        </span>
      ))}
    </div>
  );
}

function SpecTable({ spec }: { spec: ChartSpec }) {
  const { header, rows } = toTable(spec);
  return (
    <div className="ask-alaiy-table-wrap" style={{ maxHeight: 240, overflowY: "auto" }}>
      <table>
        <thead>
          <tr>{header.map((cell, index) => <th key={index}>{cell}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cellIndex === 0 ? cell : cell === null ? "—" : long(cell, spec.unit)}</td>
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
      className={cn("ask-alaiy-icon-btn", active && "is-active")}
    >
      {icon}
    </button>
  );
}

function short(value: number, unit: ChartSpec["unit"]): string {
  if (unit === "currency") return inrCompact(value);
  if (unit === "percent") return pct(value);
  return Math.abs(value) >= 10_000 ? inrCompact(value).replace("₹", "") : num(value);
}

function long(value: unknown, unit: ChartSpec["unit"]): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  if (unit === "currency") return inr(n);
  if (unit === "percent") return pct(n);
  return num(n);
}

function clip(value: unknown): string {
  const text = String(value ?? "");
  return text.length > 12 ? `${text.slice(0, 11)}…` : text;
}
