import {
  defaultBadgeStyle,
  docStatusColorMap,
  hrStatusColorMap,
  jobStatusColorMap,
  manufacturingStatusColorMap,
  paymentStatusColorMap,
  projectTaskStatusColorMap,
  salesStatusColorMap,
  stockStatusColorMap,
} from "@/constants/badge-tones";

export type ERPNextBadgeCategory =
  | "docstatus"
  | "job"
  | "payment"
  | "sales"
  | "stock"
  | "project"
  | "hr"
  | "manufacturing"
  | "generic";

const categoryMapRegistry: Record<ERPNextBadgeCategory, Record<string, string>> = {
  docstatus: docStatusColorMap,
  job: jobStatusColorMap,
  payment: paymentStatusColorMap,
  sales: salesStatusColorMap,
  stock: stockStatusColorMap,
  project: projectTaskStatusColorMap,
  hr: hrStatusColorMap,
  manufacturing: manufacturingStatusColorMap,
  generic: {},
};

export function resolveBadgeStyle(content: string, category: ERPNextBadgeCategory = "generic"): string {
  const key = content.trim().toLowerCase();

  // 1. If explicit category specified, check that specific map first
  if (category !== "generic" && categoryMapRegistry[category][key]) {
    return categoryMapRegistry[category][key];
  }

  // 2. Global Auto-Fallback across all maps if category is generic
  for (const map of Object.values(categoryMapRegistry)) {
    if (map[key]) {
      return map[key];
    }
  }

  // 3. Fallback to neutral gray badge
  return defaultBadgeStyle;
}
