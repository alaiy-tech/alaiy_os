import type { Period } from "@/types/list";
import type { ProductsOverview } from "@/types/products";

async function getMessage<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
  const data = (await res.json()) as { message: T };
  return data.message;
}

export function getProductsOverview(period: Period) {
  return getMessage<ProductsOverview>(`/api/method/alaiy_os.api.item_stats.get_products_overview?period=${period}`);
}
