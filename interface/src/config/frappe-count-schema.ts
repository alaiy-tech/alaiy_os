import { z } from "zod";

import { FRAPPE_LIST_FILTER_SCHEMA } from "./frappe-list-schema";

/**
 * Validates `types/runtime/frappe-count.ts`'s `FrappeCountSourceConfig`
 * shape - reuses `FRAPPE_LIST_FILTER_SCHEMA` so the filter vocabulary can't
 * drift between `frappe-list` and `frappe-count`. `.strict()`, matching
 * `frappe-list-schema.ts`'s convention.
 */
export const FRAPPE_COUNT_SOURCE_CONFIG_SCHEMA = z
  .object({
    type: z.literal("frappe-count"),
    doctype: z.string().min(1),
    filters: z.array(FRAPPE_LIST_FILTER_SCHEMA),
  })
  .partial({ filters: true })
  .strict();
