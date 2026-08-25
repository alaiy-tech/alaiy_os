/** Users are read through the generic resource API, mirroring
 * `lib/frappe/logs.ts`'s fetchers - the page has no bespoke backend of its
 * own, and the `User` doctype's own permissions are what decide whether the
 * read is allowed. Fetches every field `useDoctypeMeta("User")` reports
 * (minus the ones `@/components/baseline/settings/users/users-columns.tsx`
 * already folds into the combined "User" cell or gives its own dedicated
 * column) in one call, sized generously enough to page entirely client-side
 * (`OsDataTable`'s default, non-manual pagination/sort/search/filter) - a
 * reasonable simplification for an admin user list, which realistically
 * holds dozens to low hundreds of rows, not millions. */
const USERS_PAGE_SIZE = 500;

export async function fetchUsers(fields: string[]): Promise<Record<string, unknown>[]> {
  const query = new URLSearchParams();
  query.set("fields", JSON.stringify(fields));
  query.set("order_by", "creation desc");
  query.set("limit_page_length", String(USERS_PAGE_SIZE));

  const res = await fetch(`/api/resource/User?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch Users: ${res.status}`);
  const data = (await res.json()) as { data: Record<string, unknown>[] };
  return data.data;
}
