"use client";

import { useEffect, useState } from "react";

import type { DocFieldMeta } from "@/components/derived/list/types";

export type DoctypeMeta = {
  fields: DocFieldMeta[];
  autoname: string | null;
  canWrite: boolean;
  canDelete: boolean;
};

type RawDoctypeFields = {
  fields: DocFieldMeta[];
  autoname: string | null;
  can_write: boolean;
  can_delete: boolean;
};

/** Backed by alaiy_os.api.list_view.get_doctype_fields - the single source of
 * truth for what columns/filters a doctype can offer, permission-checked
 * server-side so this never needs its own client-side permission logic. */
export function useDoctypeMeta(doctype: string) {
  const [meta, setMeta] = useState<DoctypeMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetch(
      `/api/method/alaiy_os.api.list_view.get_doctype_fields?doctype=${encodeURIComponent(doctype)}`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { message?: RawDoctypeFields } | null) => {
        if (cancelled || !data?.message) return;
        setMeta({
          fields: data.message.fields,
          autoname: data.message.autoname,
          canWrite: Boolean(data.message.can_write),
          canDelete: Boolean(data.message.can_delete),
        });
      })
      .catch(() => {
        // meta stays null - callers already treat that as "not loaded yet"
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [doctype]);

  return { meta, isLoading };
}
