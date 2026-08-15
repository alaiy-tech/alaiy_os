export type ItemVariant = {
  name: string;
  item_code: string;
  item_name: string;
  image: string | null;
  standard_rate: number;
  disabled: 0 | 1;
  attributes: { attribute: string; attribute_value: string }[];
};

export async function getItemVariants(templateItemCode: string): Promise<ItemVariant[]> {
  const res = await fetch(
    `/api/method/alaiy_os.api.item_variants.get_variants?template_item_code=${encodeURIComponent(templateItemCode)}`,
  );
  if (!res.ok) throw new Error(`Failed to load variants for ${templateItemCode}`);
  const data = (await res.json()) as { message: ItemVariant[] };
  return data.message;
}
