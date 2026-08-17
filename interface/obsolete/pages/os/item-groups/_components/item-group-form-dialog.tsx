"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/primitive/button";
import { Checkbox } from "@/components/primitive/checkbox";
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
  createItemGroup,
  ItemGroupApiError,
  type ItemGroupNode,
  updateItemGroup,
} from "@/lib/frappe/item-group";

type Mode =
  | { kind: "create"; parentName: string; parentLabel: string }
  | { kind: "edit"; node: ItemGroupNode };

export function ItemGroupFormDialog({
  open,
  onOpenChange,
  mode,
  onSaved,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: Mode;
  readonly onSaved: (parentName: string) => void;
}) {
  const [name, setName] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode.kind === "edit") {
      setName(mode.node.name);
      setIsGroup(Boolean(mode.node.is_group));
    } else {
      setName("");
      setIsGroup(false);
    }
  }, [open, mode]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      if (mode.kind === "create") {
        if (!name.trim()) {
          toast.error("Item Group Name is required.");
          return;
        }
        await createItemGroup({
          item_group_name: name.trim(),
          parent_item_group: mode.parentName,
          is_group: isGroup,
        });
        toast.success(`"${name.trim()}" was created.`);
        onSaved(mode.parentName);
      } else {
        await updateItemGroup(mode.node.name, { is_group: isGroup });
        toast.success(`"${mode.node.name}" was updated.`);
        onSaved(mode.node.name);
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ItemGroupApiError
          ? error.message
          : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isCreate = mode.kind === "create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isCreate ? "New Item Group" : `Edit ${mode.node.name}`}
          </DialogTitle>
          {isCreate && (
            <DialogDescription>Under {mode.parentLabel}</DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field className="flex-row items-start gap-2 space-y-0">
            <Checkbox
              id="item-group-is-group"
              checked={isGroup}
              onCheckedChange={(checked) => setIsGroup(checked === true)}
            />
            <div className="flex flex-col gap-0.5">
              <FieldLabel htmlFor="item-group-is-group">Is Group</FieldLabel>
              <p className="text-muted-foreground text-xs">
                Further sub-groups can only be created under records marked as
                &apos;Group&apos;
              </p>
            </div>
          </Field>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="item-group-name">
              Item Group Name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="item-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isCreate}
              placeholder="e.g. Cat Supplies"
            />
            {!isCreate && (
              <p className="text-muted-foreground text-xs">
                Use Rename to change the name.
              </p>
            )}
          </Field>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {isCreate ? "Create New" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
