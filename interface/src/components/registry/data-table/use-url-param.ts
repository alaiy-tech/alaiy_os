"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A generic (zero Frappe/doctype knowledge) URL-addressable single string
 * value - clone `URLSearchParams`, patch it, `router.replace(..., {scroll:
 * false})` - the one mechanism `OsDataTable` uses for every request-driven
 * bit of query state it owns directly (sort, search, page size), mirroring
 * `usePaginationParam`'s page-number-specific sibling and `OsFilterBar`'s own
 * copy of the same pattern.
 *
 * `paramName` is caller-supplied (e.g. `"suppliers_sort"`/`"orders_search"` -
 * see docs/UI_RUNTIME.md's "Generic List Query State" for the `${name}_*`
 * convention). `resetParams` are cleared in the same navigation as any write
 * - typically this table's own `pageParam`, so changing sort/search/page
 * size never strands the user on a page number that no longer matches the
 * newly-filtered/ordered result set.
 */
export function useUrlParam(paramName: string, resetParams: string[] = []) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = paramName ? searchParams.get(paramName) : null;

  function setValue(next: string | null) {
    if (!paramName) return;
    // An empty string must collapse to null too (both mean "clear this
    // param"), which ?? doesn't do.
    // biome-ignore lint/nursery/useNullishCoalescing: see comment above
    const normalizedNext = next || null;
    // Bail before touching `resetParams` at all if this param's own value
    // isn't actually changing - without this, a caller whose effect refires
    // for an unrelated reason (e.g. a debounced search effect re-running
    // because its own setter is a fresh closure every render) would still
    // delete `resetParams` (typically this table's own page number) even
    // though nothing the user did should have reset it.
    if (normalizedNext === value) return;

    const params = new URLSearchParams(searchParams);
    if (normalizedNext) params.set(paramName, normalizedNext);
    else params.delete(paramName);
    for (const resetParam of resetParams) params.delete(resetParam);

    const query = params.toString();
    // No-op guard: without this, a caller that writes the same value on every
    // render (e.g. a debounced effect) triggers a `router.replace` every time
    // anyway, which re-renders the page and re-fires the effect - an infinite loop.
    if (query === searchParams.toString()) return;
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return { value, setValue };
}
