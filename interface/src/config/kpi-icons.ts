import type { ComponentType } from "react";

import {
  DollarSign,
  Package,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  UsersRound,
} from "lucide-react";

/** Curated, extendable-by-adding-a-line icon lookup for the `os-kpi` registry
 * component - not a wildcard import of every lucide icon, for the same
 * tree-shaking reason `config/nav-icons.ts` documents. Keys are the exact
 * PascalCase lucide component names (matching every `icon` value already
 * authored in `seeds/pages/seed-data.ts`), unlike `nav-icons.ts`'s
 * kebab-case keys - changing that convention would break every existing
 * seeded KPI node for no benefit. */
export const KPI_ICONS = {
  DollarSign,
  ShoppingBag,
  Users,
  UsersRound,
  ReceiptText,
  RotateCcw,
  PackageCheck,
  Package,
  TrendingUp,
  TrendingDown,
} satisfies Record<string, ComponentType<{ className?: string }>>;

/** The same keys as a non-empty tuple, for `component-props-schema.ts`'s
 * `z.enum()` - `Object.keys()` alone types as plain `string[]`, which
 * `z.enum` (a `[string, ...string[]]` minimum) rejects. */
export const KPI_ICON_NAMES = Object.keys(KPI_ICONS) as [string, ...string[]];
