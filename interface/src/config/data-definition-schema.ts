import { z } from "zod";

import { DATA_REQUEST_SCHEMA } from "./data-request-schema";
import { TRANSFORM_SCHEMA } from "./data-transform-schema";

/** Validates `types/runtime/data-definition.ts`'s `QueryBinding`/`DataDefinition`. */

export const QUERY_BINDING_SCHEMA = z
  .object({
    pagination: z
      .object({ pageSize: z.number().int().positive(), withTotal: z.boolean() })
      .partial({ withTotal: true })
      .strict(),
    sort: z
      .object({ allowedFields: z.array(z.string().min(1)).min(1) })
      .strict(),
    search: z.object({ fields: z.array(z.string().min(1)).min(1) }).strict(),
    // A simple opt-in flag, not a per-field declaration array - see
    // `types/runtime/data-definition.ts`'s `QueryBinding.filters` doc comment
    // for why the field allowlist moved to `exposeFields`'s own fetched
    // field list instead of living here.
    filters: z.boolean(),
  })
  .partial()
  .strict();

export const DATA_DEFINITION_SCHEMA = z
  .object({
    request: DATA_REQUEST_SCHEMA,
    query: QUERY_BINDING_SCHEMA,
    transform: TRANSFORM_SCHEMA,
    exposeFields: z.boolean(),
  })
  .partial({ query: true, transform: true, exposeFields: true })
  .strict()
  .refine(
    // Query-state substitution only ever reads/writes a `list` request's
    // own `params` - a `count`/`method` request has nothing for it to bind.
    (definition) =>
      !definition.query || definition.request.operation === "list",
    {
      message: "`query` is only meaningful for a `list` operation request",
      path: ["query"],
    },
  )
  .refine(
    // Only a `list`/`count` request has a `doctype` for
    // `fetchDoctypeFields` to look up - a `method` request has nothing.
    (definition) =>
      !definition.exposeFields || definition.request.operation !== "method",
    {
      message:
        "`exposeFields` is only meaningful for a list/count operation request (a method request has no doctype)",
      path: ["exposeFields"],
    },
  )
  .refine(
    // `query.filters: true` has no field allowlist of its own - it validates
    // a URL-supplied field against `exposeFields`'s fetched field list, so
    // there is nothing to check a filter field against without it.
    (definition) => !definition.query?.filters || definition.exposeFields === true,
    {
      message: "`query.filters` requires `exposeFields: true`",
      path: ["query", "filters"],
    },
  );
