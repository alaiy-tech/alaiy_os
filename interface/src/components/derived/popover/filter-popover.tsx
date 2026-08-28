"use client";

import { useEffect, useState } from "react";

import { Filter as FilterIcon, Plus, X } from "lucide-react";

import {
  type DocFieldMeta,
  type FilterOperator,
  type FilterRow,
  OPERATOR_LABELS,
  operatorsForFieldtype,
} from "@/components/derived/list/types";
import { Badge } from "@/components/primitive/badge";
import { Button } from "@/components/primitive/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/primitive/combobox";
import { DatePicker } from "@/components/primitive/date-picker";
import { Input } from "@/components/primitive/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/primitive/popover";
import { TooltipWrap } from "@/components/primitive/tooltip-wrap";

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

/** A single-value equality check ("=" / "!=") against a `Select` field (e.g.
 * a status column) has a known, closed set of valid values - offer a
 * dropdown instead of free text. Not `Link`: its `options` names the *target
 * doctype*, not a list of values, so it falls back to plain text like any
 * other field. Never for "in"/"not in" - those stay comma-separated text
 * regardless of fieldtype. */
function isDropdownField(fieldtype: string | undefined, operator: FilterOperator) {
  return fieldtype === "Select" && (operator === "=" || operator === "!=");
}

/** A `Select` field's `options` is Frappe's own newline-separated choice
 * list convention - a leading blank choice (common for "no default") isn't a
 * real filterable value. */
function parseSelectOptions(options: string | null | undefined): string[] {
  return (options ?? "").split("\n").map((option) => option.trim()).filter(Boolean);
}

/** A row is ready to apply once its field is picked and its value is filled in too. */
function isRowComplete(row: FilterRow): boolean {
  return Boolean(row.field) && row.value !== "";
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

  const hasAnyContent = rows.some((r) => r.field || r.value);
  const canApply = rows.length > 0 && rows.every(isRowComplete);

  function handleApply() {
    if (!canApply) return;
    onApply(rows.filter((r) => r.field));
    setOpen(false);
  }

  function handleClear() {
    setRows([]);
    onApply([]);
    setOpen(false);
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

            return (
              <div key={row.id} className="flex items-center gap-1.5">
                <Combobox
                  items={availableFields.map((f) => f.fieldname)}
                  value={row.field || null}
                  onValueChange={(fieldname) =>
                    fieldname && changeField(row.id, fieldname)
                  }
                  itemToStringLabel={(fieldname) =>
                    fieldByName.get(fieldname)?.label ?? fieldname
                  }
                >
                  <ComboboxInput
                    placeholder="Field"
                    className="w-44"
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No fields found.</ComboboxEmpty>
                    <ComboboxList>
                      {(fieldname: string) => (
                        <ComboboxItem key={fieldname} value={fieldname}>
                          {fieldByName.get(fieldname)?.label ?? fieldname}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>

                <Combobox
                  items={operators}
                  value={row.operator}
                  onValueChange={(op) =>
                    op && updateRow(row.id, { operator: op, value: "" })
                  }
                  itemToStringLabel={(op) => OPERATOR_LABELS[op]}
                >
                  <ComboboxInput placeholder="Operator" className="w-32" />
                  <ComboboxContent>
                    <ComboboxEmpty>No operators found.</ComboboxEmpty>
                    <ComboboxList>
                      {(op: FilterOperator) => (
                        <ComboboxItem key={op} value={op}>
                          {OPERATOR_LABELS[op]}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>

                {isDateField(field?.fieldtype, row.operator) ? (
                  <DatePicker
                    className="flex-1"
                    value={row.value ? new Date(row.value) : undefined}
                    onChange={(date) =>
                      updateRow(row.id, {
                        value: date ? date.toISOString().slice(0, 10) : "",
                      })
                    }
                  />
                ) : isDropdownField(field?.fieldtype, row.operator) ? (
                  <Combobox
                    items={parseSelectOptions(field?.options)}
                    value={row.value || null}
                    onValueChange={(v) => updateRow(row.id, { value: v ?? "" })}
                  >
                    <ComboboxInput
                      placeholder="Value"
                      className="flex-1"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No options found.</ComboboxEmpty>
                      <ComboboxList>
                        {(option: string) => (
                          <ComboboxItem key={option} value={option}>
                            {option}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                ) : (
                  <Input
                    type={valueInputType(field?.fieldtype, row.operator)}
                    value={row.value}
                    onChange={(e) =>
                      updateRow(row.id, { value: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleApply();
                      }
                    }}
                    placeholder={
                      row.operator === "in" || row.operator === "not in"
                        ? "Comma-separated values"
                        : row.operator === "between"
                          ? "Start, End"
                          : "Value"
                    }
                    className="flex-1"
                  />
                )}

                <TooltipWrap label="Remove filter">
                  <button
                    type="button"
                    disabled={rows.length < 2}
                    onClick={() => removeRow(row.id)}
                    aria-label="Remove filter"
                    className="flex size-7 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                  </button>
                </TooltipWrap>
              </div>
            );
          })}
        </div>

        <div className="mt-1 flex items-center justify-between border-t pt-3">
          <TooltipWrap label="Add another filter row">
            <Button
              variant="outline"
              size="sm"
              className="w-fit gap-1.5"
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
                disabled={!hasAnyContent}
                onClick={handleClear}
              >
                Clear Filters
              </Button>
            </TooltipWrap>
            <TooltipWrap label="Apply these filters">
              <Button
                size="sm"
                disabled={!canApply}
                onClick={handleApply}
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
