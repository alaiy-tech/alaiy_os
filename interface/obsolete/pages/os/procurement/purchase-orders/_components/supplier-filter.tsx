"use client";

import { useEffect, useState } from "react";

import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/primitive/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/primitive/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/primitive/popover";
import {
  type SupplierOption,
  searchSuppliers,
} from "@/lib/frappe/supplier-list";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

export function SupplierFilter({
  value,
  onChange,
}: {
  /** The selected Supplier's docname, or undefined for "any supplier". */
  readonly value?: string;
  readonly onChange: (supplier: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<SupplierOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);

    const timeout = setTimeout(() => {
      searchSuppliers(term)
        .then((results) => {
          if (!cancelled) setOptions(results);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [term, open]);

  const selected = options.find((option) => option.name === value);

  return (
    <div className="flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={open}
            className={cn(
              "justify-start font-normal",
              !value && "text-muted-foreground",
            )}
          >
            {/* Falls back to the docname: the label for an option that isn't
                in the current page of results is not worth a second lookup. */}
            {value ? (selected?.supplier_name ?? value) : "Any supplier"}
            <ChevronsUpDown className="ml-1 size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[260px] p-0">
          {/* cmdk filters the list it is given; these options already come
              back filtered by the server, so its own pass would only re-filter
              a page it cannot see past. */}
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search suppliers…"
              value={term}
              onValueChange={setTerm}
            />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Searching…" : "No suppliers found."}
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.name}
                    value={option.name}
                    onSelect={() => {
                      onChange(option.name === value ? undefined : option.name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-3.5",
                        option.name === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">
                      {option.supplier_name || option.name}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(undefined)}
          aria-label="Clear supplier filter"
        >
          <X />
        </Button>
      )}
    </div>
  );
}
