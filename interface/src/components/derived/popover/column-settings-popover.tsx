"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from "lucide-react";

import type { ColumnPrefs } from "@/components/derived/list/types";
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
import { TooltipWrap } from "@/components/primitive/tooltip-wrap";
import { cn } from "@/utils";

export interface ColumnField {
  fieldname: string;
  label: string;
}

function SortableFieldRow({
  field,
  index,
  total,
  removeDisabled,
  removeDisabledReason,
  onRemove,
  onMove,
}: {
  field: ColumnField;
  index: number;
  total: number;
  removeDisabled: boolean;
  removeDisabledReason: string;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.fieldname });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-2.5 py-1",
        isDragging && "z-10 shadow-md",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
        aria-label={`Reorder ${field.label}`}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex-1 truncate text-foreground">{field.label}</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label={`Move ${field.label} up`}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          aria-label={`Move ${field.label} down`}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronDown className="size-3.5" />
        </button>

        <button
          type="button"
          disabled={removeDisabled}
          onClick={onRemove}
          aria-label={`Remove ${field.label}`}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export interface ColumnSettingsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bare trigger element (e.g. a Button) - wrapped in its own TooltipWrap + PopoverTrigger. */
  trigger: ReactNode;
  /** Every field this doctype could show as a column - drives both the visible list and the "add field" picker. */
  availableFields: ColumnField[];
  value: ColumnPrefs;
  onSave: (prefs: ColumnPrefs) => void;
  /** The table's own default column order (what a never-customized table
   * shows) - what the Reset button reverts the draft to. */
  defaultColumnOrder: string[];
  /** Fewer than this many columns can never remain visible - the last N rows'
   * remove buttons disable once the list shrinks to exactly this size. */
  minVisibleColumns?: number;
  /** Fieldnames that can never be removed regardless of how many columns are
   * visible (e.g. Status, Grand Total) - still draggable/reorderable, just
   * never removable. Distinct from a column pinned outside columnOrder
   * entirely (like the ID column), which is neither reorderable nor listed
   * here at all. */
  compulsoryFields?: string[];
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((field, i) => field === b[i]);
}

/** Which columns show and in what order. Anchored to its own trigger, not a full-screen modal.
 * Any column that must always be visible AND always first (e.g. the ID column) should simply
 * never be included in `availableFields`/`value.columnOrder` - render it outside this component
 * instead. A column that must stay visible but can still be reordered belongs in
 * `compulsoryFields` instead. */
export function ColumnSettingsPopover({
  open,
  onOpenChange,
  trigger,
  availableFields,
  value,
  onSave,
  defaultColumnOrder,
  minVisibleColumns = 4,
  compulsoryFields = [],
}: ColumnSettingsPopoverProps) {
  const [draft, setDraft] = useState(value);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const hasChanges = !sameOrder(draft.columnOrder, value.columnOrder);

  function handleSave() {
    if (!hasChanges) return;
    onSave(draft);
    onOpenChange(false);
  }

  function handleReset() {
    setDraft({ columnOrder: defaultColumnOrder });
  }

  const compulsorySet = new Set(compulsoryFields);
  const fieldByName = new Map(availableFields.map((f) => [f.fieldname, f]));
  const visibleFields = draft.columnOrder
    .map((f) => fieldByName.get(f))
    .filter((f): f is ColumnField => Boolean(f));
  const addableFields = availableFields.filter(
    (f) => !draft.columnOrder.includes(f.fieldname),
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function move(fieldname: string, direction: -1 | 1) {
    setDraft((d) => {
      const from = d.columnOrder.indexOf(fieldname);
      const to = from + direction;
      if (to < 0 || to >= d.columnOrder.length) return d;
      return { ...d, columnOrder: arrayMove(d.columnOrder, from, to) };
    });
  }

  function remove(fieldname: string) {
    if (compulsorySet.has(fieldname)) return;
    setDraft((d) => ({
      ...d,
      columnOrder: d.columnOrder.filter((f) => f !== fieldname),
    }));
  }

  function add(fieldname: string) {
    setDraft((d) => ({ ...d, columnOrder: [...d.columnOrder, fieldname] }));
    setAddOpen(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft((d) => {
      const from = d.columnOrder.indexOf(String(active.id));
      const to = d.columnOrder.indexOf(String(over.id));
      if (from === -1 || to === -1) return d;
      return { ...d, columnOrder: arrayMove(d.columnOrder, from, to) };
    });
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[320px] p-3.5"
        onKeyDown={(e) => {
          // Ignored while the nested "Add Fields" popover is open - Enter
          // there means "select the highlighted field," not "save and close
          // the whole thing."
          if (e.key === "Enter" && !addOpen) {
            e.preventDefault();
            handleSave();
          }
        }}
      >
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium tracking-[.08em] text-muted-foreground">
              Table Columns ({visibleFields.length})
            </span>
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Plus className="size-3.5" />
                  Add Fields
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[240px] p-0">
                <Command>
                  <CommandInput placeholder="Search fields…" />
                  <CommandList>
                    <CommandEmpty>No fields left to add.</CommandEmpty>
                    <CommandGroup>
                      {addableFields.map((f) => (
                        <CommandItem
                          key={f.fieldname}
                          onSelect={() => add(f.fieldname)}
                        >
                          {f.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleFields.map((f) => f.fieldname)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex max-h-[250px] flex-col gap-1 overflow-y-auto">
                {visibleFields.map((f, i) => {
                  const isCompulsory = compulsorySet.has(f.fieldname);
                  const atMinimum = visibleFields.length <= minVisibleColumns;
                  return (
                    <SortableFieldRow
                      key={f.fieldname}
                      field={f}
                      index={i}
                      total={visibleFields.length}
                      removeDisabled={isCompulsory || atMinimum}
                      removeDisabledReason={
                        isCompulsory
                          ? "This column is required and can't be removed"
                          : `At least ${minVisibleColumns} columns must stay visible`
                      }
                      onRemove={() => remove(f.fieldname)}
                      onMove={(dir) => move(f.fieldname, dir)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="flex justify-end gap-2 border-t pt-2.5">
          <Button
            size="sm"
            variant="outline"
            disabled={sameOrder(draft.columnOrder, defaultColumnOrder)}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button size="sm" disabled={!hasChanges} onClick={handleSave}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
