"use client";

import { useEffect, useMemo, useState } from "react";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { DocFieldMeta } from "@/components/derived/list/types";
import { Button } from "@/components/primitive/button";
import { OsDataTable } from "@/components/registry/data-table/data-table";
import type { BulkActionGroup } from "@/components/registry/data-table/selection-actions";
import { PageHeader } from "@/components/registry/page-header";
import { useDoctypeMeta } from "@/hooks/use-doctype-meta";
import { fetchUsers } from "@/lib/frappe/users";

import {
  ACTIONS_COLUMN,
  buildExtraColumn,
  EXCLUDED_FROM_COLUMN_PICKER,
  FIXED_USER_COLUMNS,
  type UserFieldRow,
} from "./users-columns";

/** Avatar-cell-internal fields only - unlike `EXCLUDED_FROM_COLUMN_PICKER`
 * (which also excludes `user_type`/`enabled`/`last_login` since those already
 * have their own dedicated fixed column), filtering by any of those three is
 * still useful even though they can't be added as a *second* column. */
const EXCLUDED_FROM_FILTERS = new Set([
  "user_image",
  "first_name",
  "middle_name",
  "last_name",
]);

const DEFAULT_VISIBLE_COLUMNS = ["user_type", "status", "last_login"];
const MIN_VISIBLE_COLUMNS = 4;

const USER_SELECTION_ACTIONS: BulkActionGroup[] = [
  { items: [{ label: "Edit", action: { type: "edit" } }] },
  {
    items: [
      { label: "Delete", tone: "destructive", action: { type: "delete" } },
    ],
  },
];

export function Users() {
  const { meta, isLoading: isMetaLoading } = useDoctypeMeta("User");
  const [users, setUsers] = useState<UserFieldRow[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    setIsLoadingUsers(true);

    const fields = Array.from(
      new Set(["name", ...meta.fields.map((field) => field.fieldname)]),
    );
    fetchUsers(fields)
      .then((rows) => {
        if (!cancelled) setUsers(rows);
      })
      .catch(() => {
        if (cancelled) return;
        setUsers([]);
        toast.error("Could not load users.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingUsers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [meta]);

  const extraFields: DocFieldMeta[] = useMemo(
    () =>
      meta
        ? meta.fields.filter(
            (field) => !EXCLUDED_FROM_COLUMN_PICKER.has(field.fieldname),
          )
        : [],
    [meta],
  );

  const filterFields: DocFieldMeta[] = useMemo(
    () =>
      meta
        ? meta.fields.filter(
            (field) => !EXCLUDED_FROM_FILTERS.has(field.fieldname),
          )
        : [],
    [meta],
  );

  const columns = useMemo(
    () => [
      ...FIXED_USER_COLUMNS,
      ...extraFields.map(buildExtraColumn),
      ACTIONS_COLUMN,
    ],
    [extraFields],
  );

  const isLoading = isMetaLoading || isLoadingUsers;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Users"
        subtitle="Manage your organization members and their access."
        action={
          <Button type="button" size="sm">
            <Plus /> Add User
          </Button>
        }
      />

      <OsDataTable
        data={users}
        columns={columns}
        getRowId={(row) => String(row.name)}
        searchable
        searchPlaceholder="Search users..."
        filterable={filterFields.length > 0}
        filterFields={filterFields}
        columnVisibility
        defaultColumnOrder={DEFAULT_VISIBLE_COLUMNS}
        structuralColumnIds={["user", "actions"]}
        minVisibleColumns={MIN_VISIBLE_COLUMNS}
        selectable
        selectionActions={USER_SELECTION_ACTIONS}
        paginated
        emptyMessage={isLoading ? "Loading users…" : "No users found."}
      />
    </div>
  );
}
