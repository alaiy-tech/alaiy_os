import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

import { ITEM_IMAGE_REFERRER_POLICY, productHref } from "@/constants/products";
import type { ItemVariant } from "@/lib/frappe/item-variants";
import { formatCurrency } from "@/lib/utils";
import type { ItemAttributeRow, ItemDetail } from "@/types/products";

import { PageSection } from "./page-section";

function AttributeChips({ attributes }: { attributes: ItemAttributeRow[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {attributes.map((attribute) => (
        <span key={attribute.attribute} className="rounded-md bg-muted px-2 py-1 text-xs">
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

/**
 * One variant, as a swatch: its photo over its distinguishing attribute values.
 *
 * A link rather than a selectable option, which is the honest control here -
 * every ERPNext variant is its own Item document with its own stock and prices,
 * so picking one means opening it, not re-rendering this page against different
 * numbers.
 */
function VariantSwatch({ variant, currency }: { variant: ItemVariant; currency?: string }) {
  // The template's own attribute values are what separate one variant from the
  // next, so they are the label - the item_name repeats the template's name on
  // every swatch and is left to the title attribute instead.
  const label = variant.attributes
    .map((attribute) => attribute.attribute_value)
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={productHref(variant.name)}
      title={`${variant.item_name} (${variant.item_code})`}
      className="group flex w-[104px] shrink-0 flex-col overflow-hidden rounded-lg border transition-colors duration-100 hover:border-foreground/30"
    >
      <span className="flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
        {variant.image ? (
          <img
            src={variant.image}
            alt=""
            loading="lazy"
            referrerPolicy={ITEM_IMAGE_REFERRER_POLICY}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-[10px] text-muted-foreground">No image</span>
        )}
      </span>

      <span className="flex flex-col gap-0.5 px-2 py-1.5">
        <span className="line-clamp-2 min-h-[2.2em] font-medium text-xs leading-[1.1] group-hover:underline">
          {label || variant.item_code}
        </span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {variant.standard_rate ? formatCurrency(variant.standard_rate, { currency }) : "—"}
        </span>
        {variant.disabled ? <span className="text-[10px] text-muted-foreground">Disabled</span> : null}
      </span>
    </Link>
  );
}

/**
 * Where the item sits in the template/variant tree: the variants generated from
 * it, the template it came from, or just the attributes that describe it.
 *
 * Rendered only for items that are one of those three - see hasVariantContext.
 */
export function ItemVariantPanel({
  detail,
  currency,
}: {
  detail: Pick<ItemDetail, "item" | "template" | "attributes" | "variants">;
  currency?: string;
}) {
  const { item, template, attributes, variants } = detail;
  const isTemplate = Boolean(item.has_variants);

  // "Attributes" is the fallback for the item that is neither: a plain item
  // carrying attribute rows is not a shape ERPNext produces, but the section is
  // shown whenever there are attributes to show and should still be titled.
  let title = "Attributes";
  if (isTemplate) title = "Variants";
  else if (template) title = "Variant of";

  return (
    <PageSection
      id="item-variants"
      title={title}
      meta={isTemplate ? `${variants.length} ${variants.length === 1 ? "variant" : "variants"}` : undefined}
    >
      {!isTemplate && template && (
        <Link
          href={productHref(template.name)}
          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors duration-100 hover:bg-muted/40"
        >
          <span className="truncate font-medium">{template.item_name ?? template.name}</span>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {attributes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">
            {isTemplate ? `Varies by (${item.variant_based_on ?? "Item Attribute"})` : "Attributes"}
          </span>
          <AttributeChips attributes={attributes} />
        </div>
      )}

      {isTemplate &&
        (variants.length === 0 ? (
          <p className="text-muted-foreground text-sm">This template has no variants yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <VariantSwatch key={variant.name} variant={variant} currency={currency} />
            ))}
          </div>
        ))}
    </PageSection>
  );
}

/** A plain item is neither a template nor a variant and has no attributes, so
 * the section would say nothing - the page drops it entirely rather than render
 * an empty band between the description and the specifications. */
export function hasVariantContext(detail: Pick<ItemDetail, "item" | "attributes">): boolean {
  return Boolean(detail.item.has_variants) || Boolean(detail.item.variant_of) || detail.attributes.length > 0;
}
