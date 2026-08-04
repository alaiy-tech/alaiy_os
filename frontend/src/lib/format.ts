export function formatDate(value: string | null | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatCurrency(value: number | null | undefined, currency?: string) {
  if (value === null || value === undefined) return undefined;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "INR" }).format(value);
  } catch {
    return value.toLocaleString();
  }
}

/** Indian Cr/L compact notation, e.g. ₹4.89 Cr - used on the Dashboard's demo KPIs, ported from the design's inr(). */
export function formatINRCompact(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Full-precision INR, e.g. ₹12,498 - ported from the design's inrFull(). */
export function formatINRFull(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
