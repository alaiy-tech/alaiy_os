"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { Spinner } from "@/components/primitive/spinner";
import { productExtension } from "@/config/product-extension";
import type { ProductChildRow } from "@/config/product-extension-types";
import { ITEM_IMAGE_REFERRER_POLICY, productHref } from "@/constants/products";
import { getItemVariants } from "@/lib/frappe/item-variants";
import { formatCurrency } from "@/lib/utils";
import type { ProductRow } from "@/types/products";

/**
 * The rows shown under an expanded product.
 *
 * What "under" means is the contributing app's call: ERPNext variants of a
 * template by default, or whatever a `ProductExtension` returns from
 * `loadChildren` — a client with a flat parent/SKU catalog puts an offer's SKUs
 * here. The rendering is the same either way, which is the point of the
 * indirection: the base names no app, and a client ships a loader rather than a
 * copy of this file.
 */

/** True when this row can be expanded at all — the extension's answer, or the base's. */
export function hasProductChildren(row: ProductRow): boolean {
  if (productExtension?.hasChildren) return productExtension.hasChildren(row);
  return Boolean(row.has_variants);
}

/** ERPNext variants, mapped onto the shape the table renders. */
async function loadVariants(row: ProductRow): Promise<ProductChildRow[]> {
  const variants = await getItemVariants(row.item_code);
  return variants.map((variant) => ({
    name: variant.name,
    itemCode: variant.item_code,
    itemName: variant.item_name,
    image: variant.image,
    amount: variant.standard_rate || null,
    tags: variant.attributes.map((a) => ({
      label: a.attribute,
      value: a.attribute_value,
    })),
  }));
}

function ChildTags({
  tags,
  spec,
}: {
  tags?: ProductChildRow["tags"];
  spec?: string | null;
}) {
  if (spec)
    return (
      <span className="truncate text-muted-foreground text-sm">{spec}</span>
    );
  if (!tags?.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.label}
          className="rounded-md bg-muted px-1.5 py-0.5 text-xs"
        >
          {tag.label}: <span className="font-medium">{tag.value}</span>
        </span>
      ))}
    </div>
  );
}

function ChildAmount({
  row,
  currency,
}: {
  row: ProductChildRow;
  currency?: string;
}) {
  if (row.amount === null || row.amount === undefined)
    return <span className="text-muted-foreground">—</span>;
  const code = row.currency ?? currency;
  return (
    <span className="font-medium text-sm tabular-nums">
      {code
        ? formatCurrency(row.amount, { currency: code })
        : row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
    </span>
  );
}

export function ProductChildRows({
  row,
  colSpan,
  currency,
}: {
  readonly row: ProductRow;
  readonly colSpan: number;
  readonly currency?: string;
}) {
  const [children, setChildren] = useState<ProductChildRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChildren(null);
    setError(null);

    const load = productExtension?.loadChildren ?? loadVariants;
    load(row)
      .then((data) => {
        if (!cancelled) setChildren(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this product's items.");
      });

    return () => {
      cancelled = true;
    };
  }, [row]);

  const emptyMessage =
    productExtension?.childrenEmptyMessage ??
    "This template has no variants yet.";

  return (
    <tr className="bg-muted/30">
      <td colSpan={colSpan} className="p-0">
        <div className="border-y bg-muted/30 px-4 py-3">
          {error && <p className="text-destructive text-sm">{error}</p>}
          {!error && !children && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Spinner className="size-3.5" /> Loading…
            </div>
          )}
          {!error && children && children.length === 0 && (
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
          )}
          {!error && children && children.length > 0 && (
            <div className="flex flex-col gap-2">
              {children.map((child) => (
                <div
                  key={child.name}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 flex-none items-center justify-center overflow-hidden rounded-md border bg-muted">
                      {child.image ? (
                        <img
                          src={child.image}
                          alt={child.itemName}
                          loading="lazy"
                          referrerPolicy={ITEM_IMAGE_REFERRER_POLICY}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="text-[9px] text-muted-foreground">
                          No img
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={productHref(child.name)}
                        className="block truncate font-medium text-sm hover:underline"
                      >
                        {child.itemName}
                      </Link>
                      <div className="truncate text-muted-foreground text-xs">
                        {child.itemCode}
                      </div>
                    </div>
                  </div>
                  <ChildTags tags={child.tags} spec={child.spec} />
                  <ChildAmount row={child} currency={currency} />
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
