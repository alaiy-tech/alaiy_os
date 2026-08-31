/**
 * The chart spec the model writes, and everything needed to trust it.
 *
 * A chart reaches the client as a fenced ```alaiy-chart block inside the
 * assistant's reply (see CHART_PROMPT in alaiy_os/chat/runner.py). Nothing on
 * the server parses it, so this file is the whole validation layer -- which
 * means it must be *total*. `parseChartSpec` never throws and never returns a
 * spec the renderer can choke on; a malformed reply degrades to the raw
 * block, never to a blank panel.
 */

export type ChartKind = "bar" | "line" | "pie";
export type ChartUnit = "number" | "currency" | "percent";

export interface ChartSeries {
  name: string;
  points: (number | null)[];
}

export interface ChartSpec {
  type?: ChartKind | "auto";
  title: string;
  labels: string[];
  series: ChartSeries[];
  x?: string;
  y?: string;
  unit?: ChartUnit;
  truncated?: number;
}

export const MAX_SERIES = 4;
export const MAX_LABELS = 60;
export const MAX_PIE_SLICES = 8;
export const MIN_LABELS = 2;
export const MAX_TITLE_CHARS = 80;
export const MAX_SERIES_NAME_CHARS = 24;
export const MAX_LABEL_CHARS = 120;
export const MAX_SPEC_BYTES = 8_192;

const KINDS: ChartKind[] = ["bar", "line", "pie"];
const UNITS: ChartUnit[] = ["number", "currency", "percent"];

const DATEISH =
  /^(\d{4}-\d{2}(-\d{2})?|\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?|W\d{1,2}|Q[1-4]([ -]?\d{2,4})?|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*([ -]?\d{2,4})?)$/i;

export function parseChartSpec(raw: string): ChartSpec | null {
  if (!raw || raw.length > MAX_SPEC_BYTES) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const input = parsed as Record<string, unknown>;

  const allLabels = Array.isArray(input.labels)
    ? input.labels.map((v) => String(v ?? "").slice(0, MAX_LABEL_CHARS)).filter((v) => v !== "")
    : [];
  if (allLabels.length < MIN_LABELS) return null;

  const labels = allLabels.slice(0, MAX_LABELS);
  const truncated = allLabels.length - labels.length;

  const series: ChartSeries[] = [];
  for (const entry of Array.isArray(input.series) ? input.series : []) {
    if (series.length >= MAX_SERIES) break;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const candidate = entry as Record<string, unknown>;
    const rawPoints = candidate.points;
    if (!Array.isArray(rawPoints)) continue;

    const points: (number | null)[] = labels.map((_, index) => coerce(rawPoints[index]));
    if (points.every((point) => point === null)) continue;

    let name = String(candidate.name ?? "").slice(0, MAX_SERIES_NAME_CHARS).trim();
    if (!name || series.some((existing) => existing.name === name)) {
      name = `${name || "Series"} ${series.length + 1}`.slice(0, MAX_SERIES_NAME_CHARS);
    }
    series.push({ name, points });
  }
  if (!series.length) return null;

  const type = KINDS.includes(input.type as ChartKind) ? (input.type as ChartKind) : "auto";
  const unit = UNITS.includes(input.unit as ChartUnit) ? (input.unit as ChartUnit) : "number";

  const spec: ChartSpec = {
    type,
    title: String(input.title ?? "").slice(0, MAX_TITLE_CHARS).trim(),
    labels,
    series,
    unit,
  };
  if (typeof input.x === "string") spec.x = input.x.slice(0, MAX_SERIES_NAME_CHARS);
  if (typeof input.y === "string") spec.y = input.y.slice(0, MAX_SERIES_NAME_CHARS);
  if (truncated > 0) spec.truncated = truncated;
  return spec;
}

export function resolveType(spec: ChartSpec): ChartKind {
  const points = spec.series.flatMap((s) => s.points);
  const hasNegative = points.some((p) => p !== null && p < 0);
  const pieAble =
    spec.series.length === 1 &&
    spec.labels.length <= MAX_PIE_SLICES &&
    !hasNegative &&
    !points.some((p) => p === null) &&
    spec.unit !== "percent";

  if (spec.type === "pie") return pieAble ? "pie" : "bar";
  if (spec.type === "line") return spec.labels.length >= 3 ? "line" : "bar";
  if (spec.type === "bar") return "bar";

  const dateish = spec.labels.every((label) => DATEISH.test(label.trim()));
  if (dateish || spec.labels.length > 12) return "line";
  if (pieAble && spec.labels.length <= 6) return "pie";
  return "bar";
}

export function toRows(spec: ChartSpec): Record<string, string | number | null>[] {
  return spec.labels.map((label, index) => {
    const row: Record<string, string | number | null> = { label };
    spec.series.forEach((s) => {
      row[s.name] = s.points[index];
    });
    return row;
  });
}

export function toTable(spec: ChartSpec): { header: string[]; rows: (string | number | null)[][] } {
  return {
    header: [spec.x || "", ...spec.series.map((s) => s.name)],
    rows: spec.labels.map((label, index) => [label, ...spec.series.map((s) => s.points[index])]),
  };
}

export function slug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "chart"
  );
}

function coerce(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;

  const n = typeof value === "number" ? Number(value) : Number(salvage(value));
  return Number.isFinite(n) ? n : null;
}

function salvage(value: string): string {
  return value
    .trim()
    .replace(/^[₹$€£¥]\s*/, "")
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/\s*%$/, "");
}
