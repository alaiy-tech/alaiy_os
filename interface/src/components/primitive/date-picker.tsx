"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/primitive/button";
import { Calendar } from "@/components/primitive/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/primitive/popover";
import { cn } from "@/lib/utils";

export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "Pick a date",
}: {
  readonly value?: Date;
  readonly onChange: (date: Date | undefined) => void;
  readonly className?: string;
  readonly placeholder?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-3.5" />
          {value ? format(value, "PP") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} />
      </PopoverContent>
    </Popover>
  );
}
