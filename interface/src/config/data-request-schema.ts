import { z } from "zod";

/** Validates `types/runtime/data-request.ts`'s `DataRequest` union.
 * `.strict()` throughout - this validates a developer-authored (or, later,
 * Ask Alaiy-authored) declarative object, so an unrecognised key is a typo
 * to catch, not silently ignored. */

const FRAPPE_FILTER_OPERATORS = ["=", "!=", "like", "not like", ">", "<", ">=", "<=", "in", "not in"] as const;

const FILTER_VALUE_SCHEMA = z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]);

const ARRAY_ONLY_OPERATORS = new Set(["in", "not in"]);

/** The plain field/operator/value shape, exported so
 * `data-transform-schema.ts`'s `filter` step can build its own object from
 * the same pieces without unwrapping `FRAPPE_FILTER_SCHEMA`'s `.refine()`
 * wrapper (a `ZodEffects` has no `.shape`). */
export const FRAPPE_FILTER_FIELDS = {
  field: z.string().min(1),
  operator: z.enum(FRAPPE_FILTER_OPERATORS),
  value: FILTER_VALUE_SCHEMA,
};

export const FRAPPE_FILTER_SCHEMA = z
  .object(FRAPPE_FILTER_FIELDS)
  .strict()
  .refine((filter) => !ARRAY_ONLY_OPERATORS.has(filter.operator) || Array.isArray(filter.value), {
    message: `"in"/"not in" require an array value`,
    path: ["value"],
  })
  .refine((filter) => ARRAY_ONLY_OPERATORS.has(filter.operator) || !Array.isArray(filter.value), {
    message: 'only "in"/"not in" accept an array value',
    path: ["value"],
  });

const MAX_PAGE_SIZE = 1000;

// "fieldname asc|desc", comma-separated for multiple fields.
export const ORDER_BY_PATTERN = /^\w+\s+(asc|desc)(\s*,\s*\w+\s+(asc|desc))*$/i;

/** Extracts just the field names from an `orderBy`-shaped string (already
 * assumed to match `ORDER_BY_PATTERN`) - shared by anything that needs to
 * check every referenced field is actually allowed. */
export function parseOrderByFields(orderBy: string): string[] {
  return orderBy.split(",").map((clause) => clause.trim().split(/\s+/)[0]);
}

const FRAPPE_LIST_REQUEST_SCHEMA = z
  .object({
    type: z.literal("frappe"),
    operation: z.literal("list"),
    doctype: z.string().min(1),
    params: z
      .object({
        fields: z.array(z.string().min(1)).min(1),
        filters: z.array(FRAPPE_FILTER_SCHEMA),
        orderBy: z.string().regex(ORDER_BY_PATTERN, 'orderBy must look like "fieldname asc|desc"'),
        pageSize: z.number().int().positive().max(MAX_PAGE_SIZE),
        page: z.number().int().positive(),
      })
      .partial({ filters: true, orderBy: true, page: true })
      .strict(),
  })
  .strict();

const FRAPPE_COUNT_REQUEST_SCHEMA = z
  .object({
    type: z.literal("frappe"),
    operation: z.literal("count"),
    doctype: z.string().min(1),
    params: z
      .object({ filters: z.array(FRAPPE_FILTER_SCHEMA) })
      .partial()
      .strict(),
  })
  .partial({ params: true })
  .strict();

const METHOD_ARG_VALUE_SCHEMA = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const FRAPPE_METHOD_REQUEST_SCHEMA = z
  .object({
    type: z.literal("frappe"),
    operation: z.literal("method"),
    method: z.string().min(1),
    args: z.record(z.string(), METHOD_ARG_VALUE_SCHEMA),
  })
  .partial({ args: true })
  .strict();

export const DATA_REQUEST_SCHEMA = z.discriminatedUnion("operation", [
  FRAPPE_LIST_REQUEST_SCHEMA,
  FRAPPE_COUNT_REQUEST_SCHEMA,
  FRAPPE_METHOD_REQUEST_SCHEMA,
]);
