"use client";

import { useEffect, useState } from "react";

import { Filter as FilterIcon, Plus, X } from "lucide-react";

import {
  type DocFieldMeta,
  type FilterOperator,
  type FilterRow,
  OPERATOR_LABELS,
  operatorsForFieldtype,
} from "@/components/list/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipWrap } from "@/components/ui/tooltip-wrap";

function newRow(): FilterRow {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  return { id, field: "", operator: "=", value: "" };
}

function valueInputType(
  fieldtype: string | undefined,
  operator: FilterOperator,
) {
  if (operator === "in" || operator === "not in" || operator === "between")
    return "text";
  if (fieldtype === "Datetime") return "datetime-local";
  if (fieldtype && ["Int", "Float", "Currency", "Percent"].includes(fieldtype))
    return "number";
  return "text";
}

function isDateField(fieldtype: string | undefined, operator: FilterOperator) {
  return (
    (fieldtype === "Date" || fieldtype === "Datetime") &&
    operator !== "in" &&
    operator !== "not in" &&
    operator !== "between"
  );
}

export interface FilterPopoverProps {
  /** Scoped to whatever columns are currently offered for this doctype (see useDoctypeMeta). */
  availableFields: DocFieldMeta[];
  value: FilterRow[];
  onApply: (rows: FilterRow[]) => void;
}

/** Generic doctype filter builder: field / fieldtype-scoped operator / value rows. Anchored to its own trigger button, not a full-screen modal. */
export function FilterPopover({
  availableFields,
  value,
  onApply,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<FilterRow[]>(value);

  useEffect(() => {
    if (open) setRows(value.length ? value : [newRow()]);
  }, [open, value]);

  const fieldByName = new Map(availableFields.map((f) => [f.fieldname, f]));

  function updateRow(id: string, patch: Partial<FilterRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function changeField(id: string, fieldname: string) {
    const nextOperator = operatorsForFieldtype(
      fieldByName.get(fieldname)?.fieldtype,
    )[0];
    updateRow(id, { field: fieldname, operator: nextOperator, value: "" });
  }

  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipWrap label="Filter this list">
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="text-[13px]">
            <FilterIcon className="size-3.5" />
            Filters
            {value.length > 0 && (
              <Badge variant="default" className="h-4.5 px-1">
                {value.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
      </TooltipWrap>
      <PopoverContent className="w-[520px] p-3.5" align="start">
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const field = fieldByName.get(row.field);
            const operators = operatorsForFieldtype(field?.fieldtype);
            const noValue = row.operator === "is" || row.operator === "is not";

            return (
              <div key={row.id} className="flex items-center gap-1.5">
                <Select
                  value={row.field}
                  onValueChange={(v) => changeField(row.id, v)}
                >
                  <SelectTrigger className="h-8 w-[140px] text-[12.5px]">
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFields.map((f) => (
                      <SelectItem key={f.fieldname} value={f.fieldname}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={row.operator}
                  onValueChange={(v) =>
                    updateRow(row.id, {
                      operator: v as FilterOperator,
                      value: "",
                    })
                  }
                >
                  <SelectTrigger className="h-8 w-[150px] text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op} value={op}>
                        {OPERATOR_LABELS[op]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {noValue ? (
                  <div className="flex h-8 flex-1 items-center rounded-md border border-input bg-muted/50 px-3 text-[12.5px] text-muted-foreground">
                    —
                  </div>
                ) : isDateField(field?.fieldtype, row.operator) ? (
                  <DatePicker
                    className="h-8 flex-1 text-[12.5px]"
                    value={row.value ? new Date(row.value) : undefined}
                    onChange={(date) =>
                      updateRow(row.id, {
                        value: date ? date.toISOString().slice(0, 10) : "",
                      })
                    }
                  />
                ) : (
                  <Input
                    type={valueInputType(field?.fieldtype, row.operator)}
                    value={row.value}
                    onChange={(e) =>
                      updateRow(row.id, { value: e.target.value })
                    }
                    placeholder={
                      row.operator === "in" || row.operator === "not in"
                        ? "Comma-separated values"
                        : row.operator === "between"
                          ? "Start, End"
                          : "Value"
                    }
                    className="h-8 flex-1 text-[12.5px]"
                  />
                )}

                <TooltipWrap label="Remove filter">
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    aria-label="Remove filter"
                    className="flex size-7 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </TooltipWrap>
              </div>
            );
          })}
        </div>

        <div className="mt-3.5 flex items-center justify-between border-t pt-3">
          <TooltipWrap label="Add another filter row">
            <Button
              variant="outline"
              size="sm"
              className="w-fit gap-1.5 text-[12px]"
              onClick={() => setRows((rs) => [...rs, newRow()])}
            >
              <Plus className="size-3" />
              Add a Filter
            </Button>
          </TooltipWrap>

          <div className="flex gap-2">
            <TooltipWrap label="Remove every filter">
              <Button
                variant="outline"
                size="sm"
                className="text-[12.5px]"
                disabled={rows.length === 0}
                onClick={() => {
                  setRows([]);
                  onApply([]);
                }}
              >
                Clear Filters
              </Button>
            </TooltipWrap>
            <TooltipWrap label="Apply these filters">
              <Button
                size="sm"
                className="text-[12.5px]"
                disabled={rows.length === 0}
                onClick={() => {
                  onApply(rows.filter((r) => r.field));
                  setOpen(false);
                }}
              >
                Apply Filters
              </Button>
            </TooltipWrap>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
