/** Joins class names, skipping falsy values -- the one thing this widget
 * needs from a class-merging utility; no tailwind-merge dependency since
 * there's no Tailwind config here to conflict against. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function downloadCsv(filename: string, rows: (string | number | null)[][]): void {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("en-IN");

export function inr(value: number): string {
  return INR.format(value);
}

export function inrCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
  return INR.format(value);
}

export function num(value: number): string {
  return NUM.format(value);
}

export function pct(value: number): string {
  return `${NUM.format(value)}%`;
}

/** A small, deliberately generic categorical palette -- reads fine on both
 * Frappe Desk's light and dark themes since it doesn't depend on any
 * dashboard-specific design tokens. */
export const SERIES = ["#4C6FFF", "#2BB673", "#F5A524", "#EF476F"];
