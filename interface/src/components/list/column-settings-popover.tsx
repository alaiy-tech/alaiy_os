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

import type { ColumnPrefs } from "@/components/list/types";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipWrap } from "@/components/ui/tooltip-wrap";
import { cn } from "@/lib/utils";

export interface ColumnField {
  fieldname: string;
  label: string;
}

function SortableFieldRow({
  field,
  index,
  total,
  removeDisabled,
  onRemove,
  onMove,
}: {
  field: ColumnField;
  index: number;
  total: number;
  removeDisabled: boolean;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.fieldname });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-2.5 py-2",
        isDragging && "z-10 shadow-md",
      )}
    >
      <TooltipWrap label="Drag to reorder">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground"
          aria-label={`Reorder ${field.label}`}
        >
          <GripVertical className="size-4" />
        </button>
      </TooltipWrap>
      <span className="flex-1 truncate text-[13px] text-foreground">{field.label}</span>
      <div className="flex items-center gap-0.5">
        <TooltipWrap label="Move up">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Move ${field.label} up`}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronUp className="size-3.5" />
          </button>
        </TooltipWrap>
        <TooltipWrap label="Move down">
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label={`Move ${field.label} down`}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </TooltipWrap>
        <TooltipWrap
          label={removeDisabled ? `At least ${MIN_VISIBLE_COLUMNS} columns must stay visible` : "Remove column"}
        >
          <button
            type="button"
            disabled={removeDisabled}
            onClick={onRemove}
            aria-label={`Remove ${field.label}`}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
          >
            <X className="size-3.5" />
          </button>
        </TooltipWrap>
      </div>
    </div>
  );
}

const MIN_VISIBLE_COLUMNS = 4;

export interface ColumnSettingsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bare trigger element (e.g. a Button) - wrapped in its own TooltipWrap + PopoverTrigger. */
  trigger: ReactNode;
  /** Every field this doctype could show as a column - drives both the visible list and the "add field" picker. */
  availableFields: ColumnField[];
  value: ColumnPrefs;
  onSave: (prefs: ColumnPrefs) => void;
}

/** Which columns show and in what order. Anchored to its own trigger, not a full-screen modal.
 * Any column that must always be visible (e.g. an image column pinned first) should simply never
 * be included in `availableFields`/`value.columnOrder` - render it outside this component instead. */
export function ColumnSettingsPopover({
  open,
  onOpenChange,
  trigger,
  availableFields,
  value,
  onSave,
}: ColumnSettingsPopoverProps) {
  const [draft, setDraft] = useState(value);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const fieldByName = new Map(availableFields.map((f) => [f.fieldname, f]));
  const visibleFields = draft.columnOrder.map((f) => fieldByName.get(f)).filter((f): f is ColumnField => Boolean(f));
  const addableFields = availableFields.filter((f) => !draft.columnOrder.includes(f.fieldname));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
    setDraft((d) => ({ ...d, columnOrder: d.columnOrder.filter((f) => f !== fieldname) }));
  }

  function add(fieldname: string) {
    setDraft((d) => ({ ...d, columnOrder: [...d.columnOrder, fieldname] }));
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
      <TooltipWrap label="Column settings">
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      </TooltipWrap>
      <PopoverContent align="end" className="w-[320px] p-3.5">
        <div className="mb-2.5 text-[13px] font-semibold text-foreground">Columns</div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium tracking-[.08em] text-muted-foreground">FIELDS</span>
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <TooltipWrap label="Add fields">
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 text-[12px]">
                    <Plus className="size-3.5" />
                    Add Fields
                  </Button>
                </PopoverTrigger>
              </TooltipWrap>
              <PopoverContent align="end" className="w-[240px] p-0">
                <Command>
                  <CommandInput placeholder="Search fields…" />
                  <CommandList>
                    <CommandEmpty>No fields left to add.</CommandEmpty>
                    <CommandGroup>
                      {addableFields.map((f) => (
                        <CommandItem key={f.fieldname} onSelect={() => add(f.fieldname)}>
                          {f.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleFields.map((f) => f.fieldname)} strategy={verticalListSortingStrategy}>
              <div className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto">
                {visibleFields.map((f, i) => (
                  <SortableFieldRow
                    key={f.fieldname}
                    field={f}
                    index={i}
                    total={visibleFields.length}
                    removeDisabled={visibleFields.length <= MIN_VISIBLE_COLUMNS}
                    onRemove={() => remove(f.fieldname)}
                    onMove={(dir) => move(f.fieldname, dir)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="mt-3.5 flex justify-end gap-2 border-t pt-3.5">
          <TooltipWrap label="Discard changes">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </TooltipWrap>
          <TooltipWrap label="Save column settings">
            <Button
              onClick={() => {
                onSave(draft);
                onOpenChange(false);
              }}
            >
              Save
            </Button>
          </TooltipWrap>
        </div>
      </PopoverContent>
    </Popover>
  );
}
