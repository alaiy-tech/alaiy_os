import type { Table } from "@tanstack/react-table";
import { ChevronDown, Columns3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function DataTableColumnToggle<TData>({ table }: { table: Table<TData> }) {
  const hideable = table.getAllColumns().filter((c) => c.getCanHide());
  if (!hideable.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 gap-[7px] px-3 text-[13px] font-medium text-ink">
          <Columns3 className="size-[15px] text-slate" />
          Columns
          <ChevronDown className="size-[13px] text-ash-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[212px]">
        <DropdownMenuLabel className="text-[10.5px] font-medium tracking-[.09em] text-ash-3 uppercase">Toggle columns</DropdownMenuLabel>
        {hideable.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(!!value)}
            onSelect={(e) => e.preventDefault()}
          >
            {(column.columnDef.meta as { label?: string } | undefined)?.label ?? column.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
