import { z } from "zod";

import { DATA_REQUEST_SCHEMA } from "./data-request-schema";
import { TRANSFORM_SCHEMA } from "./data-transform-schema";

/** Validates `types/runtime/data-definition.ts`'s `QueryBinding`/`DataDefinition`. */

const QUERY_FILTER_OPERATORS = ["=", "!=", "like", "not like", ">", "<", ">=", "<="] as const;

export const QUERY_BINDING_SCHEMA = z
  .object({
    pagination: z.object({ pageSize: z.number().int().positive() }).strict(),
    sort: z.object({ allowedFields: z.array(z.string().min(1)).min(1) }).strict(),
    search: z.object({ fields: z.array(z.string().min(1)).min(1) }).strict(),
    filters: z
      .array(z.object({ field: z.string().min(1), operator: z.enum(QUERY_FILTER_OPERATORS) }).strict())
      .refine((filters) => new Set(filters.map((f) => f.field)).size === filters.length, {
        message: "each field may only appear once in query.filters",
      }),
  })
  .partial()
  .strict();

export const DATA_DEFINITION_SCHEMA = z
  .object({
    request: DATA_REQUEST_SCHEMA,
    query: QUERY_BINDING_SCHEMA,
    transform: TRANSFORM_SCHEMA,
  })
  .partial({ query: true, transform: true })
  .strict()
  .refine(
    // Query-state substitution only ever reads/writes a `list` request's
    // own `params` - a `count`/`method` request has nothing for it to bind.
    (definition) => !definition.query || definition.request.operation === "list",
    { message: "`query` is only meaningful for a `list` operation request", path: ["query"] },
  );
