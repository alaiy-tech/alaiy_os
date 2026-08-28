"use client";
"use no memo";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import type { DocFieldMeta } from "@/components/derived/list/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/primitive/avatar";
import { Button } from "@/components/primitive/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/primitive/dropdown-menu";
import { STATUS_TONE } from "@/constants/list";
import { cn, getInitials } from "@/utils";
import { formatFieldValue } from "@/utils/format";

export type UserFieldRow = Record<string, unknown>;

/** Folded into the combined "User" cell (avatar/name/email) or given their
 * own dedicated column below - never separately offered in the column
 * picker, and never fetched-then-ignored either (see `lib/frappe/users.ts`). */
export const EXCLUDED_FROM_COLUMN_PICKER = new Set([
  "user_image",
  "first_name",
  "middle_name",
  "last_name",
  "email",
  "enabled",
  "user_type",
  "last_login",
]);

function fullNameOf(row: UserFieldRow): string {
  return [row.first_name, row.middle_name, row.last_name]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");
}

function stringField(row: UserFieldRow, field: string): string | undefined {
  const value = row[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function UserCell({ row }: { row: UserFieldRow }) {
  const email = stringField(row, "email") ?? stringField(row, "name") ?? "";
  const name = fullNameOf(row) || email;
  const image = stringField(row, "user_image");

  return (
    <div className="flex items-center gap-3">
      <Avatar size="lg">
        {image && <AvatarImage src={image} alt={name} />}
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground text-sm">{name}</div>
        <div className="truncate text-muted-foreground text-sm">{email}</div>
      </div>
    </div>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs",
        enabled ? STATUS_TONE.success : STATUS_TONE.neutral,
      )}
    >
      {enabled ? "Enabled" : "Disabled"}
    </span>
  );
}

/** The fixed columns every Users table render has, in the exact order and
 * with the exact defaults specified: checkbox (added by `OsDataTable`'s own
 * `selectable`, not here) → User (combined, structural) → User Type → Status
 * (backed by the real `enabled` field, not a fictional multi-state one) →
 * Last Logged In → Actions (structural, no header text, narrow). Any other
 * doctype field the org wants shown is added via `buildExtraColumn` below,
 * driven entirely by `useDoctypeMeta("User")` - never hardcoded here. */
export const FIXED_USER_COLUMNS: ColumnDef<UserFieldRow>[] = [
  {
    id: "user",
    header: "User",
    cell: ({ row }) => <UserCell row={row.original} />,
    enableHiding: false,
    enableSorting: false,
  },
  {
    accessorKey: "user_type",
    header: "User Type",
    cell: ({ row }) => <span className="text-sm">{stringField(row.original, "user_type") ?? "—"}</span>,
  },
  {
    id: "status",
    accessorKey: "enabled",
    header: "Status",
    cell: ({ row }) => <StatusBadge enabled={Number(row.original.enabled) === 1} />,
  },
  {
    accessorKey: "last_login",
    header: "Last Logged In",
    cell: ({ row }) => <span className="text-sm">{formatFieldValue(row.original.last_login, "Datetime")}</span>,
  },
];

export const ACTIONS_COLUMN: ColumnDef<UserFieldRow> = {
  id: "actions",
  header: () => null,
  cell: () => (
    <div className="flex w-10 justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Open user actions"
            className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
            size="icon-sm"
            variant="ghost"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>View profile</DropdownMenuItem>
          <DropdownMenuItem>Edit user</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Deactivate user</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
  enableHiding: false,
  enableSorting: false,
};

/** One generic, doctype-meta-driven column per extra field the org adds via
 * the column picker - rendering is keyed only by fieldtype, exactly like
 * `settings/logs`' own doctype-generic columns (`formatFieldValue`), since
 * this page knows nothing else about what a given field means. */
export function buildExtraColumn(field: DocFieldMeta): ColumnDef<UserFieldRow> {
  return {
    accessorKey: field.fieldname,
    header: field.label,
    cell: ({ row }) => (
      <span className="text-sm">{formatFieldValue(row.original[field.fieldname], field.fieldtype)}</span>
    ),
  };
}
