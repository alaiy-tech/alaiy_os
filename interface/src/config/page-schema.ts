import { z } from "zod";

import { DATA_DEFINITION_SCHEMA } from "./data-definition-schema";

/**
 * The structural specification of a UI Definition, as read from the
 * database (genuinely external, editable-outside-the-build input, unlike
 * the TypeScript-checked-at-compile-time seeds under `seeds/`). `zod` is
 * already a dependency (used today only by the login form's `zodResolver`)
 * - this establishes it as this repo's convention for validating untrusted
 * JSON at a route boundary, since none existed before.
 *
 * `type` (on a component node) is validated only as a non-empty string, not
 * against the closed `ComponentType` union in `types/runtime/node.ts` - this
 * keeps schema validation about *structure* (is this a well-formed node?)
 * and registry resolution about *vocabulary* (is this a real component?),
 * the same separation the renderer already established: an unresolvable
 * `type` renders as the existing safe "Unknown component type" placeholder,
 * it's never a validation failure. Coupling this schema to the registry's
 * closed union would also make every new feature's component types a
 * change to two places instead of one. Consumed by `runtime/validate/validate.ts`.
 */

export const RESPONSIVE_VALUE_SCHEMA = z
  .object({
    base: z.number().optional(),
    sm: z.number().optional(),
    md: z.number().optional(),
    lg: z.number().optional(),
    xl: z.number().optional(),
  })
  .partial();

export const NODE_LAYOUT_SCHEMA = z.object({ span: RESPONSIVE_VALUE_SCHEMA.optional() });

// A binding is either `{ source, path? }` (a Data Source Registry id - a
// domain-specific source with real business logic) or `{ ref, path? }` - a
// named lookup into the page's own `data` dict (`PAGE_DEFINITION_SCHEMA`
// below), for sharing one resolved `DataDefinition` across multiple
// bindings without duplicating it.
export const DATA_SOURCE_REF_SCHEMA = z.union([
  z.object({
    source: z.string().min(1),
    path: z.string().min(1).optional(),
  }),
  z.object({
    ref: z.string().min(1),
    path: z.string().min(1).optional(),
  }),
]);

export const DATA_MAP_SCHEMA = z.record(z.string(), DATA_SOURCE_REF_SCHEMA);

export const LAYOUT_NODE_BASE_SCHEMA = z.object({
  id: z.string().min(1),
  kind: z.literal("layout"),
  type: z.enum(["section", "stack", "inline", "grid"]),
  columns: RESPONSIVE_VALUE_SCHEMA.optional(),
  layout: NODE_LAYOUT_SCHEMA.optional(),
});

export const COMPONENT_NODE_BASE_SCHEMA = z.object({
  id: z.string().min(1),
  kind: z.literal("component"),
  type: z.string().min(1),
  layout: NODE_LAYOUT_SCHEMA.optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  data: DATA_MAP_SCHEMA.optional(),
});

export type UINodeInput =
  | (z.infer<typeof LAYOUT_NODE_BASE_SCHEMA> & { children: UINodeInput[] })
  | (z.infer<typeof COMPONENT_NODE_BASE_SCHEMA> & { children?: UINodeInput[] });

// `z.lazy` + an explicit `z.ZodType<UINodeInput>` annotation is the standard
// pattern for a recursive zod schema - without it TS can't infer a type that
// references itself.
export const UI_NODE_SCHEMA: z.ZodType<UINodeInput> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    LAYOUT_NODE_BASE_SCHEMA.extend({ children: z.array(UI_NODE_SCHEMA) }),
    COMPONENT_NODE_BASE_SCHEMA.extend({ children: z.array(UI_NODE_SCHEMA).optional() }),
  ]),
);

export const PAGE_DEFINITION_SCHEMA = z.object({
  id: z.string().min(1),
  kind: z.literal("page"),
  // Named, page-scoped data definitions - see `types/runtime/page.ts`'s
  // `UIPageDefinition.data` doc comment. This schema is NOT `.strict()`
  // (see this file's module doc), so this field must be declared here
  // explicitly - zod's default behavior for an undeclared key is to
  // silently strip it from the parsed output, not error, which would make
  // every page's `data` dict quietly vanish on its way through
  // `validatePageConfig` otherwise.
  data: z.record(z.string(), DATA_DEFINITION_SCHEMA).optional(),
  children: z.array(UI_NODE_SCHEMA),
});

export const PAGE_CONFIG_FILE_SCHEMA = z.object({
  id: z.string().min(1),
  route: z.string().min(1).startsWith("/"),
  metadata: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  definition: PAGE_DEFINITION_SCHEMA,
});
