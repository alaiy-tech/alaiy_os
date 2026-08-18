"use client";

import { useState } from "react";

import { ChevronDown, Copy, Download, Pencil, Trash2 } from "lucide-react";
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
import { Button } from "@/components/primitive/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/primitive/dropdown-menu";

export function SelectionActionsMenu({
  selectedIds,
}: {
  readonly selectedIds: string[];
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const count = selectedIds.length;

  function copyIds() {
    navigator.clipboard.writeText(selectedIds.join(", "));
    toast.success(
      count === 1
        ? "Copied ID to clipboard."
        : `Copied ${count} IDs to clipboard.`,
    );
  }

  function comingSoon(action: string) {
    toast.info(`${action} is coming soon.`);
  }

  function confirmDelete() {
    setDeleteOpen(false);
    toast.info("Delete is coming soon.");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            {count} selected
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={copyIds}>
            <Copy /> {count === 1 ? "Copy ID" : "Copy IDs"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => comingSoon("Edit")}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => comingSoon("Export")}>
            <Download /> Export
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {count === 1 ? "this product" : `these ${count} products`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {count === 1
                ? "This product will be permanently deleted. This cannot be undone."
                : `These ${count} products will be permanently deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
