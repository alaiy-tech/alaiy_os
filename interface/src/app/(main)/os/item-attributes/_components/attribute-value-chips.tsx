"use client";

import { useState } from "react";

import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { TooltipWrap } from "@/components/ui/tooltip-wrap";
import {
  addItemAttributeValue,
  deleteItemAttributeValue,
  ItemAttributeApiError,
  renameItemAttributeValue,
} from "@/lib/frappe/item-attribute";
import { collidesWith, findDuplicateKeys, normalizeValue } from "@/lib/item-attributes";
import { cn } from "@/lib/utils";
import type { ItemAttributeValue } from "@/types/item-attributes";

export function AttributeValueChips({
  attribute,
  values,
  onValuesChange,
}: {
  readonly attribute: string;
  readonly values: ItemAttributeValue[];
  readonly onValuesChange: (values: ItemAttributeValue[]) => void;
}) {
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newValue, setNewValue] = useState("");
  const [pending, setPending] = useState(false);

  const duplicateKeys = findDuplicateKeys(values.map((value) => value.attribute_value));

  async function run(action: () => Promise<ItemAttributeValue[]>, success: string) {
    setPending(true);
    try {
      onValuesChange(await action());
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof ItemAttributeApiError ? error.message : "Something went wrong.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function handleAdd() {
    const value = newValue.trim();
    if (!value) return;

    if (
      collidesWith(
        values.map((existing) => existing.attribute_value),
        value,
      )
    ) {
      toast.error(`"${value}" already exists on ${attribute}.`);
      return;
    }

    if (await run(() => addItemAttributeValue(attribute, value), `"${value}" was added.`)) setNewValue("");
  }

  async function handleRename(row: ItemAttributeValue) {
    const value = draft.trim();
    if (!value || value === row.attribute_value) {
      setEditingRow(null);
      return;
    }

    // Every value except the one being renamed — re-typing a value in a
    // different case is a legitimate edit, not a collision with itself.
    const others = values.filter((other) => other.name !== row.name).map((other) => other.attribute_value);
    if (collidesWith(others, value)) {
      toast.error(`"${value}" already exists on ${attribute}.`);
      return;
    }

    if (await run(() => renameItemAttributeValue(attribute, row.name, value), `Renamed to "${value}".`)) {
      setEditingRow(null);
    }
  }

  function handleDelete(row: ItemAttributeValue) {
    void run(() => deleteItemAttributeValue(attribute, row.name), `"${row.attribute_value}" was removed.`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {values.map((row) => {
        const isDuplicate = duplicateKeys.has(normalizeValue(row.attribute_value));

        if (editingRow === row.name) {
          return (
            <span key={row.name} className="flex items-center gap-1">
              <Input
                autoFocus
                className="h-7 w-32"
                value={draft}
                disabled={pending}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleRename(row);
                  if (event.key === "Escape") setEditingRow(null);
                }}
                aria-label={`Rename ${row.attribute_value}`}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                onClick={() => void handleRename(row)}
                aria-label="Save value"
              >
                {pending ? <Spinner /> : <Check />}
              </Button>
            </span>
          );
        }

        return (
          <TooltipWrap
            key={row.name}
            label={isDuplicate ? "Same as another value apart from casing" : `Abbreviation: ${row.abbr}`}
          >
            <Badge
              variant={isDuplicate ? "destructive" : "secondary"}
              className={cn("h-7 gap-0 pr-1 pl-2", isDuplicate && "border-destructive/40")}
            >
              <button
                type="button"
                className="cursor-text pr-1"
                disabled={pending}
                onClick={() => {
                  setEditingRow(row.name);
                  setDraft(row.attribute_value);
                }}
              >
                {row.attribute_value}
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-5"
                disabled={pending}
                onClick={() => handleDelete(row)}
                aria-label={`Remove ${row.attribute_value}`}
              >
                <X />
              </Button>
            </Badge>
          </TooltipWrap>
        );
      })}

      <span className="flex items-center gap-1">
        <Input
          className="h-7 w-32"
          placeholder="Add value..."
          value={newValue}
          disabled={pending}
          onChange={(event) => setNewValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleAdd();
          }}
          aria-label={`Add a value to ${attribute}`}
        />
        <Button
          variant="outline"
          size="icon-sm"
          disabled={pending || !newValue.trim()}
          onClick={() => void handleAdd()}
          aria-label="Add value"
        >
          {pending ? <Spinner /> : <Plus />}
        </Button>
      </span>
    </div>
  );
}
