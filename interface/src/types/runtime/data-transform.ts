import type { FrappeFilterOperator } from "./data-request";

/** How a data definition reshapes the raw response from its `request` - a
 * small closed set of steps rather than a source-type-specific behavior.
 * `select`/`filter`/`sort`/`limit` operate on `rows`; `count`/`sum`/`avg`/
 * `min`/`max` read `rows` without consuming it (so several aggregates can
 * run over the same row set); `group` replaces `rows` with one summary row
 * per group; `formula` computes a new value from prior results; `lookup`
 * maps a prior result through a static value->value table. See
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
       * by the field's literal value. `"auto"` picks day/month/year from the
       * page's own active `?period=` toggle (resolved server-side, before
       * `transform-engine.ts` ever sees this step - see `resolver.ts`'s
       * `substituteTransformSentinels`/`PERIOD_TO_GRANULARITY`), so a chart
       * grouped "over time" reads sensibly at every period instead of always
       * bucketing by the same fixed unit regardless of the window size. */
      granularity?: "day" | "month" | "year" | "auto";
      aggregate: { type: "sum" | "count" | "avg" | "min" | "max"; field?: string; as: string };
    }
  | { type: "formula"; expression: string; as: string }
  | {
      type: "lookup";
      /** A prior computed result's name (e.g. a method request's own raw
       * response field, echoed straight into `computed`) - not a row field;
       * `group`/aggregates already replace/populate `rows` before this could
       * run, so a `lookup` scoped to `computed` covers every real case
       * without also needing a `rows`-scoped variant. */
      field: string;
      /** Exact-match `field` value -> replacement, e.g.
       * `{"1D": "since last day"}` - the same generic, not-metric-specific
       * spirit as the rest of this pipeline (nothing here means "period"
       * specifically; it's just a static string->string table). */
      cases: Record<string, string>;
      /** Used when `field`'s value matches no entry in `cases` - omitted
       * leaves the output field `undefined` rather than throwing. */
      default?: string;
      as: string;
    };
