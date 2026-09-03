"use client";

import { useEffect, useState } from "react";

import type { DocFieldMeta } from "@/components/list/types";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { fetchLogDocument } from "@/lib/frappe/logs";
import { drawerFields, formatFieldValue, isLongText, TIMESTAMP_FIELD } from "@/lib/logs";
import type { LogRow } from "@/types/logs";

/** The whole document behind one row.
 *
 * Fetched when the drawer opens rather than carried over from the table: the
 * table asks for the handful of columns it shows, and the fields worth opening a
 * log for — a response body, a stack trace — are exactly the ones it left
 * behind. */
export function LogDetailSheet({
  doctype,
  name,
  fields,
  onClose,
}: {
  doctype: string;
  name: string | null;
  fields: DocFieldMeta[];
  onClose: () => void;
}) {
  const [doc, setDoc] = useState<LogRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    if (!name) return;

    let cancelled = false;
    setIsLoading(true);
    setHasFailed(false);
    setDoc(null);

    fetchLogDocument(doctype, name)
      .then((result) => {
        if (cancelled) return;
        setDoc(result);
        setHasFailed(result === null);
      })
      .catch(() => {
        if (!cancelled) setHasFailed(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [doctype, name]);

  const shown = doc ? drawerFields(fields, doc) : [];

  return (
    <Sheet open={Boolean(name)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">{name}</SheetTitle>
          <SheetDescription>
            {doc?.[TIMESTAMP_FIELD] ? formatDateTime(String(doc[TIMESTAMP_FIELD])) : doctype}
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <div className="flex flex-col gap-4 p-4">
          {isLoading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {hasFailed && !isLoading && (
            <p className="text-muted-foreground text-sm">This entry could not be loaded. It may have been deleted.</p>
          )}

          {doc && shown.length === 0 && !isLoading && (
            <p className="text-muted-foreground text-sm">This entry recorded no values.</p>
          )}

          {doc &&
            shown.map((field) => {
              const value = doc[field.fieldname];
              return (
                <div key={field.fieldname} className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">{field.label}</span>
                  {isLongText(field.fieldtype) ? (
                    // Long values arrive as whatever the app wrote — often JSON
                    // or an error body. Kept monospace and wrapped rather than
                    // pretty-printed: this is meant to be the recorded text.
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 font-mono text-xs">
                      {String(value)}
                    </pre>
                  ) : (
                    <span className="break-words text-sm">{formatFieldValue(value, field.fieldtype)}</span>
                  )}
                </div>
              );
            })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
