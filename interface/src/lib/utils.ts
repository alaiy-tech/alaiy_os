import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getInitials = (str: string): string => {
  if (typeof str !== "string" || !str.trim()) return "?";

  return (
    str
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
};

/** Turns a raw Frappe fieldname into a human label - "item_name" -> "Item Name".
 * Use as the fallback whenever a field's real `label` from doctype meta isn't
 * available yet (e.g. meta still loading, or a column defined before meta
 * loaded), so table/column headers never show a raw snake_case fieldname. */
export function formatFieldLabel(fieldname: string): string {
  return fieldname
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
