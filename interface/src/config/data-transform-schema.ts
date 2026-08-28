import { z } from "zod";

import { FRAPPE_FILTER_FIELDS } from "./data-request-schema";

/** Validates `types/runtime/data-transform.ts`'s `TransformStep` union.
 * `formula.expression` gets a length cap here (defense in depth alongside
 * `runtime/data/formula.ts`'s own parser-level guards - see that file) and
 * a permissive character-class pre-check; the parser itself is the real
 * safety boundary, this just rejects obvious garbage before it gets there. */

const MAX_FORMULA_LENGTH = 200;
const FORMULA_CHARACTER_CLASS = /^[0-9a-zA-Z_.+\-*/() ]*$/;

const AGGREGATE_TYPES = ["sum", "count", "avg", "min", "max"] as const;

const SELECT_STEP_SCHEMA = z.object({ type: z.literal("select"), fields: z.array(z.string().min(1)).min(1) }).strict();

// Unlike `FRAPPE_FILTER_SCHEMA` (the request-level filter), this doesn't
// cross-check the array/scalar operator-value pairing - `z.discriminatedUnion`
// needs a plain `ZodObject` per branch, not a `.refine()`-wrapped one, and a
// mismatched pairing here just makes `transform-engine.ts`'s `filter` step
// safely match nothing rather than reaching Frappe at all, so it's a much
// lower-stakes gap than the request-level one.
const FILTER_STEP_SCHEMA = z.object({ type: z.literal("filter"), ...FRAPPE_FILTER_FIELDS }).strict();

const SORT_STEP_SCHEMA = z
  .object({ type: z.literal("sort"), field: z.string().min(1), direction: z.enum(["asc", "desc"]) })
  .strict();

const LIMIT_STEP_SCHEMA = z.object({ type: z.literal("limit"), count: z.number().int().positive() }).strict();

const COUNT_STEP_SCHEMA = z.object({ type: z.literal("count"), as: z.string().min(1) }).strict();

const NUMERIC_AGGREGATE_STEP_SCHEMA = (type: "sum" | "avg" | "min" | "max") =>
  z.object({ type: z.literal(type), field: z.string().min(1), as: z.string().min(1) }).strict();

const GROUP_STEP_SCHEMA = z
  .object({
    type: z.literal("group"),
    by: z.string().min(1),
    granularity: z.enum(["day", "month", "year", "auto"]),
    aggregate: z
      .object({
        type: z.enum(AGGREGATE_TYPES),
        field: z.string().min(1),
        as: z.string().min(1),
      })
      .partial({ field: true })
      .strict(),
  })
  .partial({ granularity: true })
  .strict();

const FORMULA_STEP_SCHEMA = z
  .object({
    type: z.literal("formula"),
    expression: z
      .string()
      .min(1)
      .max(MAX_FORMULA_LENGTH)
      .regex(FORMULA_CHARACTER_CLASS, "expression has an unsupported character"),
    as: z.string().min(1),
  })
  .strict();

const LOOKUP_STEP_SCHEMA = z
  .object({
    type: z.literal("lookup"),
    field: z.string().min(1),
    cases: z.record(z.string(), z.string()),
    default: z.string(),
    as: z.string().min(1),
  })
  .partial({ default: true })
  .strict();

export const TRANSFORM_STEP_SCHEMA = z.discriminatedUnion("type", [
  SELECT_STEP_SCHEMA,
  FILTER_STEP_SCHEMA,
  SORT_STEP_SCHEMA,
  LIMIT_STEP_SCHEMA,
  COUNT_STEP_SCHEMA,
  NUMERIC_AGGREGATE_STEP_SCHEMA("sum"),
  NUMERIC_AGGREGATE_STEP_SCHEMA("avg"),
  NUMERIC_AGGREGATE_STEP_SCHEMA("min"),
  NUMERIC_AGGREGATE_STEP_SCHEMA("max"),
  GROUP_STEP_SCHEMA,
  FORMULA_STEP_SCHEMA,
  LOOKUP_STEP_SCHEMA,
]);

export const TRANSFORM_SCHEMA = z.array(TRANSFORM_STEP_SCHEMA);
