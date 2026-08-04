"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A generic (zero Frappe/doctype knowledge) URL-addressable sort value - the
 * same clone-`URLSearchParams`-then-`router.replace(..., {scroll:false})`
 * pattern `usePaginationParam` already uses, holding one literal
 * `"fieldname asc|desc"` string (the exact format `frappe-list`'s own static
 * `orderBy` already uses - no new mini-language).
 *
 * `paramName` is caller-supplied (e.g. `"suppliers_sort"` - see
 * `docs/UI_RUNTIME.md`'s "Generic List Query State" for the `${name}_sort`
 * convention). `resetParams` are cleared in the same navigation as any sort
 * write - typically this table's own `pageParam`, so changing sort never
 * strands the user on a page number that no longer matches the newly
 * ordered result set, without `OsDataTable` needing separate bookkeeping for
 * that rule.
 */
export function useSortParam(paramName: string, resetParams: string[] = []) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = paramName ? searchParams.get(paramName) : null;

  function setValue(next: string | null) {
    if (!paramName) return;
    const params = new URLSearchParams(searchParams);
    if (next) params.set(paramName, next);
    else params.delete(paramName);
    for (const resetParam of resetParams) params.delete(resetParam);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return { value, setValue };
}
