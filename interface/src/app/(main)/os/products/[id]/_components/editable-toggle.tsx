"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ItemApiError, updateItem } from "@/lib/frappe/item-actions";
import { cn } from "@/lib/utils";

/**
 * One Item Check field, written the moment it is flipped.
 *
 * No edit mode and no save button, unlike EditableField: a checkbox has one
 * other state, so an intermediate "editing a boolean" step would be ceremony
 * around a single click. The flip is reverted on the screen if the write is
 * refused, which is the whole rollback a boolean needs.
 *
 * `as="chip"` reads as a pill in a row of them — for the flags that describe
 * what an item is for. `as="switch"` is for a state an operator sets
 * deliberately, where a pill would look like a label rather than a control.
 */
export function EditableToggle({
  item,
  field,
  label,
  value,
  canWrite,
  as = "chip",
  invert = false,
}: {
  item: string;
  field: string;
  label: string;
  value: boolean;
  canWrite: boolean;
  as?: "chip" | "switch";
  /** For a field stored as the opposite of what it is called — `disabled`
   * shown as "Active". The control reads and writes the negation. */
  invert?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  // Same shape as EditableField's: what was written, and the prop it replaced,
  // so the flip shows at once and stops overriding when the server catches up.
  const [just, setJust] = useState<{ from: boolean; to: boolean } | null>(null);

  const stored = just && just.from === value ? just.to : value;
  const shown = invert ? !stored : stored;

  const commit = async (next: boolean) => {
    const stateToStore = invert ? !next : next;
    setSaving(true);
    try {
      await updateItem(item, { [field]: stateToStore });
      setJust({ from: value, to: stateToStore });
      // Derived server-side: the status badge reads `disabled`, and the stock
      // pill reads `is_stock_item`.
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ItemApiError ? error.message : `Could not change ${label}.`);
    } finally {
      setSaving(false);
    }
  };

  if (as === "switch") {
    return (
      <span className="flex items-center gap-2">
        <Switch
          checked={shown}
          disabled={!canWrite || saving}
          aria-label={label}
          onCheckedChange={(checked) => void commit(Boolean(checked))}
        />
        <span className="font-medium text-sm">{label}</span>
        {saving && <Spinner className="size-3 text-muted-foreground" />}
      </span>
    );
  }

  // A reader sees the flags that are set and nothing about the ones that are
  // not: an off chip is a control for turning something on, and rendering it to
  // someone who cannot would read as a claim about the item.
  if (!canWrite) {
    if (!shown) return null;
    return (
      <Badge variant="outline" className="border-0 bg-muted font-normal text-xs">
        {label}
      </Badge>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      aria-label={label}
      disabled={saving}
      onClick={() => void commit(!shown)}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-4xl px-2 text-xs transition-colors duration-100 disabled:opacity-50",
        shown ? "bg-muted font-medium text-foreground" : "border text-muted-foreground hover:text-foreground",
      )}
    >
      {saving && <Spinner className="size-3" />}
      {label}
    </button>
  );
}
