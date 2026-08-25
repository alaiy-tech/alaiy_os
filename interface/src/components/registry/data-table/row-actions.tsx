"use client";

import { Fragment, useState } from "react";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";

import { MoreHorizontal } from "lucide-react";

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/primitive/dropdown-menu";

/**
 * The `os-data-table` "actions" column's declarative shape - a row of
 * dropdown menu groups (each its own `DropdownMenuGroup`, separated but never
 * labelled), each holding items with a label, an optional text tone, and a
 * closed action vocabulary: `navigate` (a real, working row link, with
 * `{field}` placeholders substituted from the row itself), or `edit`/`delete`
 * (deliberately just a placeholder dialog for now - no generic doctype
 * edit-form or delete-confirmation exists in this runtime yet; building
 * those for real is a separate, much larger piece of work).
 */
export type RowActionTone = "default" | "destructive";

export type RowAction =
  | { type: "navigate"; url: string }
  | { type: "edit" }
  | { type: "delete" };

export type RowActionItem = {
  label: string;
  tone?: RowActionTone;
  action: RowAction;
};

export type RowActionGroup = {
  items: RowActionItem[];
};

/** Substitutes every `{field}` in `template` with that field's value on
 * `row` - the same plain, no-expression-language spirit as this runtime's
 * other declarative surfaces (see `runtime/data/formula.ts`'s doc comment
 * on why a real expression language is deliberately out of scope). An
 * unresolved placeholder (a typo'd field name) becomes an empty string
 * rather than leaving the literal `{field}` in the URL. */
function interpolate(template: string, row: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_match, field: string) => {
    const value = row[field];
    return value === null || value === undefined ? "" : String(value);
  });
}

function RowActionsMenu<TRow extends Record<string, unknown>>({
  row,
  groups,
  rowLabel,
}: {
  row: TRow;
  groups: RowActionGroup[];
  rowLabel: string;
}) {
  const router = useRouter();
  const [placeholderLabel, setPlaceholderLabel] = useState<string | null>(null);

  function handleAction(item: RowActionItem) {
    if (item.action.type === "navigate") {
      router.push(interpolate(item.action.url, row));
      return;
    }
    // "edit" / "delete" - a real generic doctype edit form / delete
    // confirmation is out of scope for now; this dialog is the disclosed
    // placeholder, not a silently-dead click.
    setPlaceholderLabel(item.label);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Open actions for ${rowLabel}`}
            className="size-5 rounded-md text-muted-foreground hover:bg-muted/50"
            size="icon-sm"
            variant="ghost"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {groups.map((group, groupIndex) => (
            <Fragment key={`group-${groupIndex}`}>
              {groupIndex > 0 && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                {group.items.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    variant={item.tone === "destructive" ? "destructive" : "default"}
                    onClick={() => handleAction(item)}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={placeholderLabel !== null} onOpenChange={(open) => !open && setPlaceholderLabel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {placeholderLabel} — {rowLabel}
            </DialogTitle>
            <DialogDescription>This action isn't wired up yet.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Builds the "actions" column: no header text, a narrow right-aligned
 * trigger cell - structural (never sortable/hideable), meant to be appended
 * as the table's last column and added to `structuralColumnIds`. `rowLabel`
 * identifies the row in the edit/delete placeholder dialog's title -
 * defaults to `getRowId`'s own value when the caller doesn't supply one. */
export function buildActionsColumn<TRow extends Record<string, unknown>>(
  groups: RowActionGroup[],
  rowLabel: (row: TRow) => string,
): ColumnDef<TRow, unknown> {
  return {
    id: "actions",
    header: () => null,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <RowActionsMenu row={row.original} groups={groups} rowLabel={rowLabel(row.original)} />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  };
}
