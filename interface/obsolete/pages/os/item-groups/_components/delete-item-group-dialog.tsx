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
} from "@/components/primitive/alert-dialog";
import { deleteItemGroup, ItemGroupApiError } from "@/lib/frappe/item-group";

export function DeleteItemGroupDialog({
  open,
  onOpenChange,
  name,
  onDeleted,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly name: string;
  readonly onDeleted: (name: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    setSubmitting(true);
    try {
      await deleteItemGroup(name);
      toast.success(`"${name}" was deleted.`);
      onDeleted(name);
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

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm</AlertDialogTitle>
          <AlertDialogDescription>
            Permanently delete{" "}
            <span className="font-semibold text-foreground">{name}</span>?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={submitting}>
            Yes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
