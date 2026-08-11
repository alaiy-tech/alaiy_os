"use client";

import { useState } from "react";

import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteItemAttribute, ItemAttributeApiError } from "@/lib/frappe/item-attribute";

export function DeleteAttributeDialog({
  open,
  onOpenChange,
  attribute,
  usageCount,
  onDeleted,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly attribute: string;
  readonly usageCount: number;
  readonly onDeleted: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const inUse = usageCount > 0;

  async function handleDelete() {
    setSubmitting(true);
    try {
      await deleteItemAttribute(attribute);
      toast.success(`"${attribute}" was deleted.`);
      onDeleted();
      onOpenChange(false);
    } catch (error) {
      // Usage is counted when the page loads, so an attribute that looked
      // free may have picked items up since. The server checks again and
      // names them; that message is what the user needs to see here.
      toast.error(error instanceof ItemAttributeApiError ? error.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{inUse ? `Can't delete ${attribute}` : "Delete attribute"}</AlertDialogTitle>
          <AlertDialogDescription>
            {inUse ? (
              <>
                {usageCount === 1 ? "An item is" : `${usageCount} items are`} built on{" "}
                <span className="font-semibold text-foreground">{attribute}</span>. Remove it from those items first —
                deleting it would leave their variants without a defining attribute.
              </>
            ) : (
              <>
                Permanently delete <span className="font-semibold text-foreground">{attribute}</span> and all of its
                values?
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{inUse ? "Close" : "Cancel"}</AlertDialogCancel>
          {!inUse && (
            <AlertDialogAction
              onClick={(event) => {
                // The dialog closes itself on action by default; deletion can
                // still fail server-side, so it stays open until the call
                // comes back and any error has been shown.
                event.preventDefault();
                void handleDelete();
              }}
              disabled={submitting}
            >
              Delete
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
