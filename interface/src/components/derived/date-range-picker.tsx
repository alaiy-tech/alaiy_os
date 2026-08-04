"use client";

import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/primitive/button";
import { Calendar } from "@/components/primitive/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/primitive/popover";
import { cn } from "@/utils";

export type { DateRange };

function toLabel(range: DateRange | undefined, placeholder: string): string {
  if (!range?.from) return placeholder;
  // A half-picked range (first click landed, second hasn't) reads as a single
  // day rather than going blank while the user is mid-selection.
  if (!range.to) return format(range.from, "d MMM yyyy");
  return `${format(range.from, "d MMM yyyy")} – ${format(range.to, "d MMM yyyy")}`;
}

/** Fully controlled date-range filter: `value === undefined` means no range,
 * which is a state the caller has to be able to express — a list filtered by
 * date needs an "any date" position, and a picker that quietly falls back to
 * its own default would apply a filter nobody chose.
 *
 * Clearing gets its own button rather than a click-the-selection-again
 * gesture, which is undiscoverable in a range calendar. */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Any date",
  className,
}: {
  readonly value?: DateRange;
  readonly onChange: (value: DateRange | undefined) => void;
  readonly placeholder?: string;
  readonly className?: string;
}) {
  const hasValue = Boolean(value?.from);

  return (
    <div className="flex items-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start font-normal",
              !hasValue && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon className="size-3.5" />
            {toLabel(value, placeholder)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      {hasValue && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(undefined)}
          aria-label="Clear date range"
        >
          <X />
        </Button>
      )}
    </div>
  );
}
