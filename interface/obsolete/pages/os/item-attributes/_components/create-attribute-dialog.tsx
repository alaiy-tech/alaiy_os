"use client";

import { useEffect, useState } from "react";

import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/primitive/badge";
import { Button } from "@/components/primitive/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/primitive/dialog";
import { Field, FieldLabel } from "@/components/primitive/field";
import { Input } from "@/components/primitive/input";
import {
  createItemAttribute,
  ItemAttributeApiError,
} from "@/lib/frappe/item-attribute";
import { collidesWith } from "@/lib/item-attributes";

export function CreateAttributeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [valueDraft, setValueDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setValues([]);
    setValueDraft("");
  }, [open]);

  function addValue() {
    const value = valueDraft.trim();
    if (!value) return;

    if (collidesWith(values, value)) {
      toast.error(`"${value}" is already in the list.`);
      return;
    }

    setValues((current) => [...current, value]);
    setValueDraft("");
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Attribute name is required.");
      return;
    }

    // A value still sitting in the input is one the user typed and meant to
    // keep — pressing Create shouldn't quietly drop it.
    const pendingValue = valueDraft.trim();
    const finalValues =
      pendingValue && !collidesWith(values, pendingValue)
        ? [...values, pendingValue]
        : values;

    setSubmitting(true);
    try {
      await createItemAttribute(name.trim(), finalValues);
      toast.success(`"${name.trim()}" was created.`);
      onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ItemAttributeApiError
          ? error.message
          : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Attribute</DialogTitle>
          <DialogDescription>
            Attributes define how item variants differ — Colour, Size, Material.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="attribute-name">
              Attribute Name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="attribute-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Colour"
            />
          </Field>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="attribute-value">Values</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="attribute-value"
                value={valueDraft}
                onChange={(event) => setValueDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  // The dialog has a single button; without this the form
                  // would submit instead of taking the value.
                  event.preventDefault();
                  addValue();
                }}
                placeholder="e.g. Red"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={addValue}
                aria-label="Add value"
              >
                <Plus />
              </Button>
            </div>

            {values.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {values.map((value) => (
                  <Badge
                    key={value}
                    variant="secondary"
                    className="h-7 gap-0 pr-1 pl-2"
                  >
                    {value}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-5"
                      onClick={() =>
                        setValues((current) =>
                          current.filter((entry) => entry !== value),
                        )
                      }
                      aria-label={`Remove ${value}`}
                    >
                      <X />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </Field>
        </div>

        <DialogFooter>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
