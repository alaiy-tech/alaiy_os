import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ITEM_IMAGE_REFERRER_POLICY, productHref } from "@/constants/products";
import type { ItemVariant } from "@/lib/frappe/item-variants";
import { formatCurrency } from "@/lib/utils";
import type { ItemAttributeRow, ItemDetail } from "@/types/products";

function AttributeChips({ attributes }: { attributes: ItemAttributeRow[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {attributes.map((attribute) => (
        <span key={attribute.attribute} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
          {attribute.attribute}
          {attribute.attribute_value ? (
            <>
              : <span className="font-medium">{attribute.attribute_value}</span>
            </>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function VariantLine({ variant, currency }: { variant: ItemVariant; currency?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 flex-none items-center justify-center overflow-hidden rounded-md border bg-muted">
          {variant.image ? (
            <img
              src={variant.image}
              alt={variant.item_name}
              loading="lazy"
              referrerPolicy={ITEM_IMAGE_REFERRER_POLICY}
              className="size-full object-cover"
            />
          ) : (
            <span className="text-[9px] text-muted-foreground">No img</span>
          )}
        </div>
        <div className="min-w-0">
          <Link href={productHref(variant.name)} className="block truncate font-medium text-sm hover:underline">
            {variant.item_name}
          </Link>
          <div className="truncate text-muted-foreground text-xs">{variant.item_code}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {variant.disabled ? (
          <Badge variant="outline" className="border-0 bg-muted font-normal text-xs">
            Disabled
          </Badge>
        ) : null}
        <span className="font-medium text-sm tabular-nums">
          {variant.standard_rate ? formatCurrency(variant.standard_rate, { currency }) : "—"}
        </span>
      </div>
    </div>
  );
}

/** Where the item sits in the template/variant tree: the template it was
 * generated from, or the variants generated from it, plus the attributes that
 * separate them. Rendered only for items that are one or the other — see
 * hasItemRelations. */
export function ItemRelations({
  detail,
  currency,
}: {
  detail: Pick<ItemDetail, "item" | "template" | "attributes" | "variants">;
  currency?: string;
}) {
  const { item, template, attributes, variants } = detail;
  const isTemplate = Boolean(item.has_variants);
  // "Attributes" is the fallback for the item that is neither: a plain item
  // carrying attribute rows is not a shape ERPNext produces, but the card is
  // shown whenever there are attributes to show and should still be titled.
  let title = "Attributes";
  if (isTemplate) title = "Variants";
  else if (template) title = "Variant of";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">{title}</CardTitle>
        <CardDescription className="text-foreground text-xl leading-none tracking-tight">
          {isTemplate && `${variants.length} ${variants.length === 1 ? "variant" : "variants"}`}
          {!isTemplate && template && (
            <Link href={productHref(template.name)} className="hover:underline">
              {template.item_name ?? template.name}
            </Link>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {attributes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">
              {isTemplate ? `Varies by (${item.variant_based_on ?? "Item Attribute"})` : "Attributes"}
            </span>
            <AttributeChips attributes={attributes} />
          </div>
        )}

        {isTemplate && (
          <div className="flex flex-col gap-2">
            {variants.length === 0 ? (
              <p className="text-muted-foreground text-sm">This template has no variants yet.</p>
            ) : (
              variants.map((variant) => <VariantLine key={variant.name} variant={variant} currency={currency} />)
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** A plain item is neither a template nor a variant and has no attributes, so
 * the card would say nothing — the page drops it entirely rather than render an
 * empty panel next to the summary. */
export function hasItemRelations(detail: Pick<ItemDetail, "item" | "attributes">): boolean {
  return Boolean(detail.item.has_variants) || Boolean(detail.item.variant_of) || detail.attributes.length > 0;
}
