import { frappeFetch } from "@/lib/frappe/server";
import type { DocFieldMeta } from "@/types/list";

/**
 * Server-side counterpart to `hooks/use-doctype-meta.ts`'s client-side hook -
 * same whitelisted `alaiy_os.api.list_view.get_doctype_fields` method
 * (already permission-checked and fieldtype-filtered server-side, so this
 * never needs its own permission logic), called via `frappeFetch` instead of
 * a browser `fetch`, so a named data definition's `exposeFields: true`
 * (`resolver.ts`) can resolve the doctype's full field list alongside its
 * rows/count in one server-side pass, no extra client round-trip. Never
 * throws - a failed/forbidden doctype degrades to an empty field list,
 * matching every other fetcher in this module's silent-null convention.
 */
export async function fetchDoctypeFields(doctype: string): Promise<DocFieldMeta[]> {
  const res = await frappeFetch(
    `/api/method/alaiy_os.api.list_view.get_doctype_fields?doctype=${encodeURIComponent(doctype)}`,
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { message?: { fields?: DocFieldMeta[] } };
  return body.message?.fields ?? [];
}
