import type { FrappeFilterOperator } from "./data-request";

/** How a data definition reshapes the raw response from its `request` - a
 * small closed set of steps rather than a source-type-specific behavior.
 * `select`/`filter`/`sort`/`limit` operate on `rows`; `count`/`sum`/`avg`/
 * `min`/`max` read `rows` without consuming it (so several aggregates can
 * run over the same row set); `group` replaces `rows` with one summary row
 * per group; `formula` computes a new value from prior results. See
 * `runtime/data/transform-engine.ts`. */
export type TransformStep =
  | { type: "select"; fields: string[] }
  | { type: "filter"; field: string; operator: FrappeFilterOperator; value: string | number | (string | number)[] }
  | { type: "sort"; field: string; direction: "asc" | "desc" }
  | { type: "limit"; count: number }
  | { type: "count"; as: string }
  | { type: "sum"; field: string; as: string }
  | { type: "avg"; field: string; as: string }
  | { type: "min"; field: string; as: string }
  | { type: "max"; field: string; as: string }
  | {
      type: "group";
      by: string;
      /** Truncates a date-valued `by` field before grouping - e.g. every row's
       * `transaction_date` collapses to its containing month. Omitted, groups
       * by the field's literal value. */
      granularity?: "day" | "month" | "year";
      aggregate: { type: "sum" | "count" | "avg" | "min" | "max"; field?: string; as: string };
    }
  | { type: "formula"; expression: string; as: string };
