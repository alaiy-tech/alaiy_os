import { z } from "zod";

/**
 * Validates `types/runtime/frappe-list.ts`'s `FrappeListSourceConfig` shape.
 * `.strict()` throughout (top level and every nested object), matching
 * `component-props-schema.ts`'s convention rather than `page-schema.ts`'s
 * more permissive one - deliberately, because this validates a
 * developer-authored TypeScript object's vocabulary (an unrecognised key is
 * a typo to catch), not genuinely external JSON.
 */

const FRAPPE_LIST_FILTER_OPERATORS = ["=", "!=", "like", "not like", ">", "<", ">=", "<=", "in", "not in"] as const;

const FILTER_VALUE_SCHEMA = z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]);

const ARRAY_ONLY_OPERATORS = new Set(["in", "not in"]);

export const FRAPPE_LIST_FILTER_SCHEMA = z
  .object({
    field: z.string().min(1),
    operator: z.enum(FRAPPE_LIST_FILTER_OPERATORS),
    value: FILTER_VALUE_SCHEMA,
  })
  .strict()
  .refine((filter) => !ARRAY_ONLY_OPERATORS.has(filter.operator) || Array.isArray(filter.value), {
    message: `"in"/"not in" require an array value`,
    path: ["value"],
  })
  .refine((filter) => ARRAY_ONLY_OPERATORS.has(filter.operator) || !Array.isArray(filter.value), {
    message: 'only "in"/"not in" accept an array value',
    path: ["value"],
  });

const MAX_PAGE_SIZE = 200;

export const FRAPPE_LIST_PAGINATION_SCHEMA = z
  .object({
    pageSize: z.number().int().positive().max(MAX_PAGE_SIZE),
    page: z.number().int().positive(),
  })
  .partial({ page: true })
  .strict();

// "fieldname asc|desc", comma-separated for multiple fields. Exported so
// `runtime/data/resolver.ts`'s `readNamedSort` can validate a request-driven
// `${name}_sort` value against this exact same shape.
export const ORDER_BY_PATTERN = /^\w+\s+(asc|desc)(\s*,\s*\w+\s+(asc|desc))*$/i;

/** Extracts just the field names from an `orderBy`-shaped string (already
 * assumed to match `ORDER_BY_PATTERN`) - e.g. `"name asc, modified desc"` ->
 * `["name", "modified"]`. Shared by anything that needs to check every
 * referenced field is actually allowed (`resolver.ts`'s `readNamedSort`),
 * so the parsing logic can't drift from the pattern that validates the
 * string's shape in the first place. */
export function parseOrderByFields(orderBy: string): string[] {
  return orderBy.split(",").map((clause) => clause.trim().split(/\s+/)[0]);
}

const FRAPPE_LIST_QUERY_FILTER_OPERATORS = ["=", "!=", "like", "not like", ">", "<", ">=", "<="] as const;

export const FRAPPE_LIST_QUERY_FILTER_SCHEMA = z
  .object({
    field: z.string().min(1),
    operator: z.enum(FRAPPE_LIST_QUERY_FILTER_OPERATORS),
  })
  .strict();

export const FRAPPE_LIST_SEARCH_SCHEMA = z
  .object({
    fields: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const FRAPPE_LIST_SOURCE_CONFIG_SCHEMA = z
  .object({
    type: z.literal("frappe-list"),
    // Optional: required only for the standalone-factory use case
    // (`registerDataSource(createFrappeListSource({id, description, ...}))`).
    // An inline config declared directly in a page definition's `data`
    // binding omits both - `createFrappeListSource` synthesizes them from
    // `doctype` (see `runtime/data/frappe-list-resolver.ts`).
    id: z.string().min(1),
    description: z.string().min(1),
    doctype: z.string().min(1),
    fields: z.array(z.string().min(1)).min(1),
    filters: z.array(FRAPPE_LIST_FILTER_SCHEMA),
    orderBy: z.string().regex(ORDER_BY_PATTERN, 'orderBy must look like "fieldname asc|desc"'),
    pagination: FRAPPE_LIST_PAGINATION_SCHEMA,
    queryFilters: z.array(FRAPPE_LIST_QUERY_FILTER_SCHEMA),
    search: FRAPPE_LIST_SEARCH_SCHEMA,
  })
  .partial({ id: true, description: true, filters: true, orderBy: true, queryFilters: true, search: true })
  .strict()
  .refine(
    (config) => {
      const staticFields = new Set((config.filters ?? []).map((filter) => filter.field));
      return !(config.queryFilters ?? []).some((queryFilter) => staticFields.has(queryFilter.field));
    },
    {
      message: "a field cannot appear in both `filters` and `queryFilters` on the same config",
      path: ["queryFilters"],
    },
  );
