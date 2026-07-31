export function formatDate(value: string | null | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatCurrency(value: number | null | undefined, currency?: string) {
  if (value === null || value === undefined) return undefined;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(value);
  } catch {
    return value.toLocaleString();
  }
}
