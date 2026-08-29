import type { FrappeFilterOperator } from "@/types/runtime/data-request";
import type { TransformStep } from "@/types/runtime/data-transform";

import { evaluateFormula } from "./formula";

/** What a `transform` pipeline threads through each step. `rows` is the
 * current row set (present after a `list` request, or after `group`
 * replaces it with per-group summaries); `computed` accumulates scalar
 * results (`count`/`sum`/`avg`/`min`/`max`/`formula`, or the raw fields of
 * a `count`/`method` request's response) - kept separate from `rows` so
 * several aggregates can run over the *same* row set in sequence (the AOV
 * shape: `sum` then `count` then a `formula` dividing them, none of which
 * consume `rows`). The final flat value exposed to a component binding is
 * `{ ...computed, rows }` (or just `computed` when there's no `rows`). */
export type TransformContext = {
  rows?: Record<string, unknown>[];
  computed: Record<string, unknown>;
};

type Row = Record<string, unknown>;

function coerceForCompare(value: unknown): number | string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && typeof value !== "boolean") return numeric;
  return String(value).toLowerCase();
}

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/** A lighter cousin of `components/registry/data-table/apply-filters.ts`'s
 * `matchesRow` - that one is fieldtype-aware because it filters end-user
 * text input against a table's own already-fetched rows; this one filters
 * already-JSON-typed values straight from a Frappe response, so there's no
 * fieldtype metadata to consult. Same operator vocabulary. */
function matchesFilter(row: Row, field: string, operator: FrappeFilterOperator, filterValue: unknown): boolean {
  const raw = row[field];

  if (operator === "like" || operator === "not like") {
    const matches = String(raw ?? "")
      .toLowerCase()
      .includes(String(filterValue).replace(/^%|%$/g, "").toLowerCase());
    return operator === "like" ? matches : !matches;
  }
  if (operator === "in" || operator === "not in") {
    const values = (Array.isArray(filterValue) ? filterValue : [filterValue]).map((v) => String(v).toLowerCase());
    const matches = values.includes(String(raw ?? "").toLowerCase());
    return operator === "in" ? matches : !matches;
  }

  const current = coerceForCompare(raw);
  const target = coerceForCompare(filterValue);
  if (current === null || target === null) return operator === "!=";
  const comparison = compareValues(current, target);
  switch (operator) {
    case "=":
      return comparison === 0;
    case "!=":
      return comparison !== 0;
    case ">":
      return comparison > 0;
    case "<":
      return comparison < 0;
    case ">=":
      return comparison >= 0;
    case "<=":
      return comparison <= 0;
    default:
      return true;
  }
}

function numericField(rows: Row[], field: string): number[] {
  return rows.map((row) => Number(row[field])).filter((value) => Number.isFinite(value));
}

function aggregate(type: "sum" | "avg" | "min" | "max" | "count", rows: Row[], field: string | undefined): number {
  if (type === "count") return rows.length;
  const values = numericField(rows, field ?? "");
  if (values.length === 0) return 0;
  switch (type) {
    case "sum":
      return values.reduce((total, value) => total + value, 0);
    case "avg":
      return values.reduce((total, value) => total + value, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
  }
}

/** Truncates a date-valued field to the requested granularity - Frappe
 * returns dates as `"YYYY-MM-DD"`/`"YYYY-MM-DD HH:mm:ss"`, so this is a
 * plain string slice, not a real date parse (cheap, and immune to timezone
 * surprises since it never constructs a `Date`). */
const GRANULARITY_LENGTH: Record<"day" | "month" | "year", number> = { year: 4, month: 7, day: 10 };

function truncateDate(value: unknown, granularity: "day" | "month" | "year"): string {
  const raw = String(value ?? "");
  return raw.slice(0, GRANULARITY_LENGTH[granularity]);
}

function groupRows(rows: Row[], step: Extract<TransformStep, { type: "group" }>): Row[] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    // `"auto"` is always resolved to a real day/month/year by
    // `resolver.ts`'s `substituteTransformSentinels` before this ever runs -
    // this engine has no notion of a period to resolve it against itself.
    // Falling back to ungrouped-by-literal-value (same as `granularity`
    // omitted) rather than throwing is just this file's usual
    // degrade-gracefully stance for an input that "shouldn't happen".
    const key =
      step.granularity && step.granularity !== "auto"
        ? truncateDate(row[step.by], step.granularity)
        : String(row[step.by] ?? "");
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.entries()].map(([key, groupRowsForKey]) => ({
    key,
    [step.aggregate.as]: aggregate(step.aggregate.type, groupRowsForKey, step.aggregate.field),
  }));
}

function applyStep(context: TransformContext, step: TransformStep): TransformContext {
  const rows = context.rows ?? [];

  switch (step.type) {
    case "select":
      return {
        ...context,
        rows: rows.map((row) => Object.fromEntries(step.fields.map((field) => [field, row[field]]))),
      };
    case "filter":
      return { ...context, rows: rows.filter((row) => matchesFilter(row, step.field, step.operator, step.value)) };
    case "sort":
      return {
        ...context,
        rows: [...rows].sort((a, b) => {
          const result = compareValues(coerceForCompare(a[step.field]) ?? "", coerceForCompare(b[step.field]) ?? "");
          return step.direction === "desc" ? -result : result;
        }),
      };
    case "limit":
      return { ...context, rows: rows.slice(0, step.count) };
    case "count":
      return { ...context, computed: { ...context.computed, [step.as]: rows.length } };
    case "sum":
    case "avg":
    case "min":
    case "max":
      return { ...context, computed: { ...context.computed, [step.as]: aggregate(step.type, rows, step.field) } };
    case "group":
      return { ...context, rows: groupRows(rows, step) };
    case "formula":
      return {
        ...context,
        computed: { ...context.computed, [step.as]: evaluateFormula(step.expression, context.computed) },
      };
    case "lookup": {
      const raw = context.computed[step.field];
      const key = raw === null || raw === undefined ? undefined : String(raw);
      const value = key !== undefined && key in step.cases ? step.cases[key] : step.default;
      return { ...context, computed: { ...context.computed, [step.as]: value } };
    }
    default: {
      const _exhaustive: never = step;
      return context;
    }
  }
}

/** Runs a `transform` pipeline over a request's raw result, in order. An
 * absent/empty pipeline is a no-op passthrough. */
export function applyTransforms(context: TransformContext, steps: TransformStep[] | undefined): TransformContext {
  let current = context;
  for (const step of steps ?? []) current = applyStep(current, step);
  return current;
}

/** The flat value a component binding actually sees - `rows` is folded back
 * in alongside every computed key, matching the shape `path`-based bindings
 * (`{ ref, path: "rows" }`/`{ ref, path: "aov" }`) already expect. */
export function toResolvedValue(context: TransformContext): Record<string, unknown> {
  return context.rows !== undefined ? { ...context.computed, rows: context.rows } : { ...context.computed };
}
