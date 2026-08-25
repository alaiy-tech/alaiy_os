"use client";

import { Fragment, useState } from "react";

import { ListChecks } from "lucide-react";

import { Button } from "@/components/primitive/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/primitive/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/primitive/dropdown-menu";

/**
 * The `os-data-table` bulk "Actions (N)" button - shown in the toolbar only
 * once at least one row is checkbox-selected (`selectable`). Same
 * declarative dropdown-menu-groups-of-items shape as the per-row 3-dot menu
 * (`row-actions.tsx`), but its own, narrower action vocabulary: `edit` |
 * `delete` only, both still deliberately just a placeholder dialog (no
 * generic bulk-edit form or bulk-delete endpoint exists in this runtime yet -
 * same disclosed scope as the per-row menu). No `navigate` here - jumping to
 * one URL doesn't mean anything for an arbitrary set of selected rows.
 * Unlike the per-row menu, a group here MAY carry its own `label` (rendered
 * via `DropdownMenuLabel`) - `selectable` implies a real, potentially
 * multi-group action set, worth being able to label.
 */
export type BulkActionTone = "default" | "destructive";

export type BulkAction = { type: "edit" } | { type: "delete" };

export type BulkActionItem = {
  label: string;
  tone?: BulkActionTone;
  action: BulkAction;
};

export type BulkActionGroup = {
  label?: string;
  items: BulkActionItem[];
};

/** `count` is the number of currently checkbox-selected rows - the button's
 * own "Actions (N)" label, and what the placeholder dialog references
 * instead of a single row's identity (there's no one row here). */
export function SelectionActionsMenu({
  groups,
  count,
}: {
  groups: BulkActionGroup[];
  count: number;
}) {
  const [placeholderLabel, setPlaceholderLabel] = useState<string | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <ListChecks className="size-3.5" />
            Actions ({count})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {groups.map((group, groupIndex) => (
            <Fragment key={`group-${groupIndex}`}>
              {groupIndex > 0 && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                {group.label && (
                  <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                )}
                {group.items.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    variant={
                      item.tone === "destructive" ? "destructive" : "default"
                    }
                    onClick={() => setPlaceholderLabel(item.label)}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={placeholderLabel !== null}
        onOpenChange={(open) => !open && setPlaceholderLabel(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {placeholderLabel} — {count} selected
            </DialogTitle>
            <DialogDescription>
              This action isn&apos;t wired up yet.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
