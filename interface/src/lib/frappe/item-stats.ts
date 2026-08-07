export type SalesPeriod = "1D" | "1W" | "1M" | "1Y";
export type StockPeriod = "1W" | "1M" | "1Y";

async function getMessage<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
  const data = (await res.json()) as { message: T };
  return data.message;
}

export function getUnitsSold(period: SalesPeriod) {
  return getMessage<{ period: string; units_sold: number }>(
    `/api/method/alaiy_os.api.item_stats.get_units_sold?period=${period}`,
  );
}

export function getStockMix() {
  return getMessage<{ out_of_stock: number; low_stock: number; in_stock: number }>(
    "/api/method/alaiy_os.api.item_stats.get_stock_mix",
  );
}

export function getOnHandTrend(period: StockPeriod) {
  return getMessage<{ period: string; points: { date: string; on_hand: number }[] }>(
    `/api/method/alaiy_os.api.item_stats.get_on_hand_trend?period=${period}`,
  );
}

export type PeriodComparison = { current: number; previous: number };

export type ProductsOverview = {
  period: string;
  units_sold: PeriodComparison;
  on_hand_units: PeriodComparison;
  average_unit_value: PeriodComparison;
  active_skus: PeriodComparison;
};

export function getProductsOverview(period: SalesPeriod) {
  return getMessage<ProductsOverview>(`/api/method/alaiy_os.api.item_stats.get_products_overview?period=${period}`);
}

export type TopSkuItem = {
  item_code: string;
  item_name: string;
  image: string | null;
  qty_sold: number;
  amount: number;
};

export function getTopSku(period: StockPeriod) {
  return getMessage<{ period: string; items: TopSkuItem[] }>(
    `/api/method/alaiy_os.api.item_stats.get_top_sku?period=${period}&limit=1`,
  );
}
