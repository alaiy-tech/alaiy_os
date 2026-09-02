"use client";

import { useEffect, useState } from "react";

import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type CustomerOption, searchCustomers } from "@/lib/frappe/customer-list";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

export function CustomerFilter({
  value,
  onChange,
}: {
  /** The selected Customer's docname, or undefined for "any customer". */
  readonly value?: string;
  readonly onChange: (customer: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setIsLoading(true);

    const timeout = setTimeout(() => {
      searchCustomers(term)
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
            className={cn("justify-start font-normal", !value && "text-muted-foreground")}
          >
            {/* Falls back to the docname: the label for an option that isn't
                in the current page of results is not worth a second lookup. */}
            {value ? (selected?.customer_name ?? value) : "Any customer"}
            <ChevronsUpDown className="ml-1 size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[260px] p-0">
          {/* cmdk filters the list it is given; these options already come
              back filtered by the server, so its own pass would only re-filter
              a page it cannot see past. */}
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search customers…" value={term} onValueChange={setTerm} />
            <CommandList>
              <CommandEmpty>{isLoading ? "Searching…" : "No customers found."}</CommandEmpty>
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
                    <Check className={cn("size-3.5", option.name === value ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{option.customer_name || option.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value && (
        <Button variant="ghost" size="icon-sm" onClick={() => onChange(undefined)} aria-label="Clear customer filter">
          <X />
        </Button>
      )}
    </div>
  );
}
