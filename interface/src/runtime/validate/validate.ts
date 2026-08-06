import { PAGE_CONFIG_FILE_SCHEMA, type UINodeInput } from "@/config/page-schema";
import type { PageConfigFile, ValidationResult } from "@/types/runtime/page";

/**
 * Runtime validation for page configuration read from the database
 * (genuinely external, editable-outside-the-build input, unlike the
 * TypeScript-checked-at-compile-time seeds under `seeds/`). See
 * `config/page-schema.ts` for the zod specification this checks against.
 */

function collectIds(node: UINodeInput, ids: string[]): void {
  ids.push(node.id);
  const children = node.kind === "layout" ? node.children : (node.children ?? []);
  for (const child of children) collectIds(child, ids);
}

/** Walks the whole tree (including the page's own id) looking for id
 * collisions - `applyUIAction`'s tree helpers resolve nodes by id, so a
 * duplicate would make `REMOVE_COMPONENT`/`MOVE_COMPONENT`/etc. ambiguous
 * about which node they mean. */
export function findDuplicateIds(definition: { id: string; children: UINodeInput[] }): string[] {
  const ids: string[] = [definition.id];
  for (const child of definition.children) collectIds(child, ids);

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

/** Validates an unknown JSON value as a `PageConfigFile`. Never throws -
 * every caller gets a discriminated result instead, so a bad config can
 * always resolve to a controlled error state rather than crashing the page
 * (or the whole `/os` shell) it was about to render into. */
export function validatePageConfig(json: unknown): ValidationResult {
  const parsed = PAGE_CONFIG_FILE_SCHEMA.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
    };
  }

  const duplicates = findDuplicateIds(parsed.data.definition);
  if (duplicates.length > 0) {
    return { ok: false, errors: [`Duplicate node id(s): ${duplicates.join(", ")}`] };
  }

  // The schema deliberately validates component `type` as a plain string
  // (see `config/page-schema.ts`'s module doc comment) - the loosely-typed
  // parse result is narrowed to the real `UIPageDefinition` (whose
  // `ComponentNode.type` is the closed `ComponentType` union) at this one
  // boundary, the same cast Round 1/2 already applied at each JSON import site.
  return { ok: true, page: parsed.data as unknown as PageConfigFile };
}
