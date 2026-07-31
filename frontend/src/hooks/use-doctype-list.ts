import { useMemo, useState } from "react";
import { useFrappeGetDocList, type Filter } from "frappe-react-sdk";

interface UseDoctypeListOptions {
  fields: string[];
  pageSize?: number;
  /** Field the free-text search box filters on with a `like` match. */
  searchField?: string;
  orderBy?: { field: string; order?: "asc" | "desc" };
  filters?: Filter[];
}

/**
 * Shared pagination + search state for doctype list screens. Wraps
 * frappe-react-sdk's useFrappeGetDocList so every list screen (Products,
 * Sales Orders, Customers, ...) fetches real data the same way - see
 * docs/adding-a-screen.md.
 */
export function useDoctypeList<T = Record<string, unknown>>(doctype: string, options: UseDoctypeListOptions) {
  const { fields, pageSize = 20, searchField, orderBy, filters: staticFilters } = options;
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const filters = useMemo<Filter[]>(() => {
    const base = staticFilters ?? [];
    if (search && searchField) {
      return [...base, [searchField, "like", `%${search}%`] as Filter];
    }
    return base;
  }, [staticFilters, search, searchField]);

  const { data, error, isLoading } = useFrappeGetDocList<T>(doctype, {
    fields: fields as (keyof T | "*")[],
    limit: pageSize,
    limit_start: page * pageSize,
    filters,
    orderBy,
  });

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
    hasNextPage: (data?.length ?? 0) === pageSize,
  };
}
