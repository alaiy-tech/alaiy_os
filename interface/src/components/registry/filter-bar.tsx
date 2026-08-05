"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/primitive/button";
import { Input } from "@/components/primitive/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/primitive/select";

/** The `filter-bar` capability contract (brief §23) - implements exactly the
 * filter types either real page needs (`select`, `text`) plus `date-range`
 * for completeness, and deliberately nothing else: no `boolean`/`number
 * range` field, since neither is "particularly important" here and adding
 * one nothing uses would be exactly the "capability that doesn't exist"
 * this contract is supposed to avoid promising. */
export type FilterFieldType = "select" | "text" | "date-range";

export type FilterFieldConfig = {
  id: string;
  type: FilterFieldType;
  label: string;
  /** The URL search param this filter reads/writes - the *only* state it
   * owns. No second router or filter-state system: every value round-trips
   * through `useSearchParams`/`router.replace`, the same mechanism
   * `DashboardFilters`/`PeriodToggle` already used before this component
   * generalized them. */
  searchParam: string;
  options?: string[];
  defaultValue?: string;
  placeholder?: string;
};

/**
 * The `os-filter-bar` registry entry - fully generic across every page.
 * Renders one control per `filters` entry; every value lives in the URL, so
 * a Server Component page reads the same values back via its own
 * `searchParams` prop with nothing threaded between them.
 */
export function OsFilterBar({
  filters,
  resetPageParams,
}: {
  filters: FilterFieldConfig[];
  /** URL params to clear alongside a filter's own whenever any filter value
   * changes (or on Reset) - e.g. a paginated table's `pageParam`, so a
   * filter change never strands the user on a page number that no longer
   * matches the new result set. Fully generic: this component never knows
   * what a listed param *means*, only that it should go away. See
   * `docs/UI_RUNTIME.md`'s "Paginated Data Sources". */
  resetPageParams?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(params: URLSearchParams) {
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function setParam(name: string, value: string, isDefault: boolean) {
    const params = new URLSearchParams(searchParams);
    if (isDefault || !value) params.delete(name);
    else params.set(name, value);
    for (const pageParam of resetPageParams ?? []) params.delete(pageParam);

    navigate(params);
  }

  function reset() {
    const params = new URLSearchParams(searchParams);
    for (const filter of filters) {
      params.delete(filter.searchParam);
      if (filter.type === "date-range") {
        params.delete(`${filter.searchParam}_from`);
        params.delete(`${filter.searchParam}_to`);
      }
    }
    for (const pageParam of resetPageParams ?? []) params.delete(pageParam);

    navigate(params);
  }

  const hasNonDefaultValue = filters.some((filter) => {
    if (filter.type === "date-range") {
      return searchParams.get(`${filter.searchParam}_from`) || searchParams.get(`${filter.searchParam}_to`);
    }
    const value = searchParams.get(filter.searchParam);
    return value !== null && value !== (filter.defaultValue ?? "");
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        if (filter.type === "select") {
          const value = searchParams.get(filter.searchParam) ?? filter.defaultValue ?? "";
          return (
            <Select
              key={filter.id}
              value={value}
              onValueChange={(next) => setParam(filter.searchParam, next, next === filter.defaultValue)}
            >
              <SelectTrigger className="w-40" size="sm" aria-label={filter.label}>
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(filter.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          );
        }

        if (filter.type === "text") {
          const value = searchParams.get(filter.searchParam) ?? filter.defaultValue ?? "";
          return (
            <Input
              key={filter.id}
              className="h-8 w-48"
              placeholder={filter.placeholder ?? filter.label}
              value={value}
              onChange={(event) => setParam(filter.searchParam, event.target.value, false)}
            />
          );
        }

        // date-range
        const fromParam = `${filter.searchParam}_from`;
        const toParam = `${filter.searchParam}_to`;
        return (
          <div key={filter.id} className="flex items-center gap-1">
            <Input
              type="date"
              aria-label={`${filter.label} from`}
              className="h-8 w-36"
              value={searchParams.get(fromParam) ?? ""}
              onChange={(event) => setParam(fromParam, event.target.value, false)}
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              type="date"
              aria-label={`${filter.label} to`}
              className="h-8 w-36"
              value={searchParams.get(toParam) ?? ""}
              onChange={(event) => setParam(toParam, event.target.value, false)}
            />
          </div>
        );
      })}

      {hasNonDefaultValue && (
        <Button variant="ghost" size="sm" onClick={reset}>
          Reset
        </Button>
      )}
    </div>
  );
}
