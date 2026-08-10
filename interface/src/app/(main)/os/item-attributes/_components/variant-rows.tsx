"use client";

import { useEffect, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { getItemVariants, type ItemVariant } from "@/lib/frappe/item-variants";

function VariantAttributes({ attributes }: { attributes: ItemVariant["attributes"] }) {
  if (!attributes.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {attributes.map((a) => (
        <span key={a.attribute} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
          {a.attribute}: <span className="font-medium">{a.attribute_value}</span>
        </span>
      ))}
    </div>
  );
}

export function VariantRows({
  templateItemCode,
  colSpan,
}: {
  readonly templateItemCode: string;
  readonly colSpan: number;
}) {
  const [variants, setVariants] = useState<ItemVariant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVariants(null);
    setError(null);
    getItemVariants(templateItemCode)
      .then((data) => {
        if (!cancelled) setVariants(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load variants.");
      });
    return () => {
      cancelled = true;
    };
  }, [templateItemCode]);

  return (
    <tr className="bg-muted/30">
      <td colSpan={colSpan} className="p-0">
        <div className="border-y bg-muted/30 px-4 py-3">
          {error && <p className="text-destructive text-sm">{error}</p>}
          {!error && !variants && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Spinner className="size-3.5" /> Loading variants…
            </div>
          )}
          {!error && variants && variants.length === 0 && (
            <p className="text-muted-foreground text-sm">This template has no variants yet.</p>
          )}
          {!error && variants && variants.length > 0 && (
            <div className="flex flex-col gap-2">
              {variants.map((v) => (
                <div
                  key={v.name}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 flex-none items-center justify-center overflow-hidden rounded-md border bg-muted">
                      {v.image ? (
                        <img src={v.image} alt={v.item_name} className="size-full object-cover" />
                      ) : (
                        <span className="text-[9px] text-muted-foreground">No img</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{v.item_name}</div>
                      <div className="truncate text-muted-foreground text-xs">{v.item_code}</div>
                    </div>
                  </div>
                  <VariantAttributes attributes={v.attributes} />
                  <div className="text-sm font-medium tabular-nums">
                    {v.standard_rate ? v.standard_rate.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
