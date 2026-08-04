import { useEffect, useMemo, useState } from "react";
import { useFrappeGetDocCount, useFrappeGetDocList, type Filter } from "frappe-react-sdk";

interface UseDoctypeListOptions {
  fields: string[];
  pageSize?: number;
  /** Field the free-text search box filters on with a `like` match. */
  searchField?: string;
  orderBy?: { field: string; order?: "asc" | "desc" };
  /** Extra filters (dropdowns, chips, tabs) - pass a new array when these change. */
  filters?: Filter[];
}

/**
 * Shared pagination + search state for doctype list screens. Wraps
 * frappe-react-sdk's useFrappeGetDocList (+ useFrappeGetDocCount for the
 * "of N entries" footer) so every list screen fetches real data the same
 * way - see docs/adding-a-screen.md.
 */
export function useDoctypeList<T = Record<string, unknown>>(doctype: string, options: UseDoctypeListOptions) {
  const { fields, pageSize = 20, searchField, orderBy, filters: extraFilters } = options;
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const filters = useMemo<Filter[]>(() => {
    const base = extraFilters ?? [];
    if (search && searchField) {
      return [...base, [searchField, "like", `%${search}%`] as Filter];
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(extraFilters), search, searchField]);

  // Reset to page 0 whenever the effective filter set changes, so a filter
  // change while on page 3 doesn't silently show an out-of-range empty page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setPage(0), [JSON.stringify(filters)]);

  const { data, error, isLoading } = useFrappeGetDocList<T>(doctype, {
    fields: fields as (keyof T | "*")[],
    limit: pageSize,
    limit_start: page * pageSize,
    filters,
    orderBy,
  });

  const { data: totalCount } = useFrappeGetDocCount(doctype, filters);

  return {
    data: data ?? [],
    error,
    isLoading,
    page,
    setPage: (next: number) => setPage(Math.max(0, next)),
    pageSize,
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(0);
    },
    totalCount,
    hasNextPage: (data?.length ?? 0) === pageSize,
  };
}
