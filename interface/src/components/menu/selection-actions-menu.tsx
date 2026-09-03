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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Bulk-selection toolbar shared by every generic list table. `entityLabel` is
 * the singular noun for what a row represents (e.g. "product", "order") -
 * used to build the plural and the delete-confirmation sentence. */
export function SelectionActionsMenu({
  selectedIds,
  entityLabel,
}: {
  readonly selectedIds: string[];
  readonly entityLabel: string;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const count = selectedIds.length;
  const plural = `${entityLabel}s`;

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
          <Button variant="default" size="sm" className="gap-1">
            {count} selected
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={copyIds} className="gap-2">
            <Copy /> {count === 1 ? "Copy ID" : "Copy IDs"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => comingSoon("Edit")}
            className="gap-2"
          >
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => comingSoon("Export")}
            className="gap-2"
          >
            <Download /> Export
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="gap-2"
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
              Delete{" "}
              {count === 1 ? `this ${entityLabel}` : `these ${count} ${plural}`}
              ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {count === 1
                ? `This ${entityLabel} will be permanently deleted. This cannot be undone.`
                : `These ${count} ${plural} will be permanently deleted. This cannot be undone.`}
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
