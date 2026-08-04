"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A generic (zero Frappe/doctype knowledge) URL-addressable page number -
 * the same clone-`URLSearchParams`-then-`router.replace(..., {scroll:false})`
 * pattern `OSPeriodToggle`/`OsFilterBar` already use for their own URL
 * state, so a paginated table's Next/Previous causes client navigation (no
 * full reload), preserves every other existing search param, and works with
 * browser back/forward - all for free, since it's the same mechanism.
 *
 * `paramName` is caller-supplied (e.g. `"customers_page"` - see
 * `docs/UI_RUNTIME.md`'s "Paginated Data Sources" for the `${name}_page`
 * convention this is meant to be used with). `fallbackPage` is also the
 * "default" value: paging back to it deletes the param entirely rather than
 * writing it explicitly, matching `OsFilterBar.setParam`'s own
 * default-value-means-delete convention, so a page-1 URL stays clean.
 */
export function usePaginationParam(paramName: string, fallbackPage: number) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get(paramName);
  const parsed = raw ? Number(raw) : Number.NaN;
  const page = Number.isInteger(parsed) && parsed > 0 ? parsed : fallbackPage;

  function setPage(next: number) {
    const params = new URLSearchParams(searchParams);
    if (next <= fallbackPage) params.delete(paramName);
    else params.set(paramName, String(next));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return { page, setPage };
}
