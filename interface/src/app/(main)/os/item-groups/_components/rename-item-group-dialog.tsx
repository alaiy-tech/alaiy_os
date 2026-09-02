"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ItemGroupApiError, renameItemGroup } from "@/lib/frappe/item-group";

export function RenameItemGroupDialog({
  open,
  onOpenChange,
  currentName,
  onRenamed,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly currentName: string;
  readonly onRenamed: (oldName: string, newName: string) => void;
}) {
  const [newName, setNewName] = useState(currentName);
  const [merge, setMerge] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNewName(currentName);
      setMerge(false);
    }
  }, [open, currentName]);

  async function handleRename() {
    if (!newName.trim()) {
      toast.error("New Name is required.");
      return;
    }
    setSubmitting(true);
    try {
      const renamedTo = await renameItemGroup(currentName, newName.trim(), merge);
      toast.success(merge ? `Merged into "${renamedTo}".` : `Renamed to "${renamedTo}".`);
      onRenamed(currentName, renamedTo);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ItemGroupApiError ? error.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {currentName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="item-group-rename">
              New Name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input id="item-group-rename" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          </Field>

          <Field className="flex-row items-center gap-2 space-y-0">
            <Checkbox id="item-group-merge" checked={merge} onCheckedChange={(checked) => setMerge(checked === true)} />
            <FieldLabel htmlFor="item-group-merge" className="font-normal">
              Merge with existing <span className="font-semibold">(This cannot be undone)</span>
            </FieldLabel>
          </Field>
        </div>

        <DialogFooter>
          <Button onClick={handleRename} disabled={submitting}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
