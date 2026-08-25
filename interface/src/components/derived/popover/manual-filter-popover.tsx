"use client";

import { useEffect, useState } from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Filter as FilterIcon } from "lucide-react";

import { Badge } from "@/components/primitive/badge";
import { Button } from "@/components/primitive/button";
import { Input } from "@/components/primitive/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/primitive/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/primitive/select";
import { TooltipWrap } from "@/components/primitive/tooltip-wrap";
import type { ManualFilterField } from "@/components/registry/data-table/column-spec";

export interface ManualFilterPopoverProps {
  fields: ManualFilterField[];
  /** URL params to clear alongside these fields' own whenever the popover
   * Applies or Clears - typically this table's own `pageParam`, matching
   * `OsFilterBar`'s `resetPageParams`. */
  resetParams?: string[];
}

/**
 * The server-driven sibling of `FilterPopover`: one value per column marked
 * `filterable` + `filterParam` (see `column-spec.tsx`'s
 * `buildManualFilterFields`), each round-tripping through its own URL search
 * param instead of in-memory row state. Deliberately has **no operator
 * picker** - `resolver.ts`'s `readNamedFilters` only ever applies the one
 * operator declared server-side per field (`query.filters`), so offering a
 * user-editable operator the server would silently ignore would be a real
 * bug, not a style choice. Self-contained (owns its own navigation, unlike
 * `FilterPopover`) so `OsDataTable` doesn't need to broker its state -
 * writing the URL already triggers the re-render that produces new `rows`.
 */
export function ManualFilterPopover({ fields, resetParams = [] }: ManualFilterPopoverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const currentValues = () =>
    Object.fromEntries(fields.map((field) => [field.param, searchParams.get(field.param) ?? ""]));
  const [pending, setPending] = useState<Record<string, string>>(currentValues);

  // Re-reads from the URL every time the popover opens, so it never shows
  // stale values after an external navigation (browser back/forward).
  // biome-ignore lint/correctness/useExhaustiveDependencies: only `open` should retrigger this, not every searchParams change
  useEffect(() => {
    if (open) setPending(currentValues());
  }, [open]);

  function navigate(params: URLSearchParams) {
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function apply() {
    const params = new URLSearchParams(searchParams);
    for (const field of fields) {
      const value = pending[field.param]?.trim();
      if (value) params.set(field.param, value);
      else params.delete(field.param);
    }
    for (const resetParam of resetParams) params.delete(resetParam);
    navigate(params);
    setOpen(false);
  }

  function clear() {
    const params = new URLSearchParams(searchParams);
    for (const field of fields) params.delete(field.param);
    for (const resetParam of resetParams) params.delete(resetParam);
    setPending(Object.fromEntries(fields.map((field) => [field.param, ""])));
    navigate(params);
    setOpen(false);
  }

  const activeCount = fields.filter((field) => searchParams.get(field.param)).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipWrap label="Filter this list">
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="text-[13px]">
            <FilterIcon className="size-3.5" />
            Filters
            {activeCount > 0 && (
              <Badge variant="default" className="h-4.5 px-1">
                {activeCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
      </TooltipWrap>
      <PopoverContent className="w-80 p-3.5" align="start">
        <div className="flex flex-col gap-2">
          {fields.map((field) => (
            <div key={field.param} className="flex flex-col gap-1">
              <span className="text-[12.5px] text-muted-foreground">{field.label}</span>
              {field.options ? (
                <Select
                  value={pending[field.param] || undefined}
                  onValueChange={(value) => setPending((p) => ({ ...p, [field.param]: value }))}
                >
                  <SelectTrigger className="h-8 w-full text-[12.5px]">
                    <SelectValue placeholder={`Any ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={pending[field.param] ?? ""}
                  onChange={(event) => setPending((p) => ({ ...p, [field.param]: event.target.value }))}
                  placeholder={field.label}
                  className="h-8 text-[12.5px]"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
          <Button variant="outline" size="sm" className="text-[12.5px]" disabled={activeCount === 0} onClick={clear}>
            Clear Filters
          </Button>
          <Button size="sm" className="text-[12.5px]" onClick={apply}>
            Apply Filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
