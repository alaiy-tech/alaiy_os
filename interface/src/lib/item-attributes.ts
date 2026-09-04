import type { ItemAttributeRow } from "@/types/item-attributes";

/** Attribute values are compared case-insensitively throughout, because that
 * is how Item Attribute's own validation compares them: "Red" and "red" in the
 * same attribute make the whole document unsaveable. Flagging them in the UI
 * is what turns that late server-side rejection into something visible while
 * typing. */
export function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

/** Normalized keys that appear more than once in the list. */
export function findDuplicateKeys(values: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    const key = normalizeValue(value);
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }

  return duplicates;
}

/** Whether `candidate` would collide with a value already in `existing`. */
export function collidesWith(existing: string[], candidate: string): boolean {
  const key = normalizeValue(candidate);
  if (!key) return false;
  return existing.some((value) => normalizeValue(value) === key);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

/** "1 – 10, step 0.5" — how a numeric attribute states its values, standing in
 * for the value chips it doesn't have. */
export function formatAttributeRange(attribute: ItemAttributeRow): string {
  const range = `${formatNumber(attribute.from_range)} – ${formatNumber(attribute.to_range)}`;
  return attribute.increment ? `${range}, step ${formatNumber(attribute.increment)}` : range;
}
