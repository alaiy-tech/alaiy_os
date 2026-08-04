import { useParams } from "react-router-dom";
import { useFrappeGetDoc, useFrappeGetDocList } from "frappe-react-sdk";
import { Image as ImageIcon, Printer } from "lucide-react";

import { DetailView, type DetailSection } from "@/components/data/DetailView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

interface ItemDoc {
  name: string;
  item_code: string;
  item_name: string;
  item_group: string;
  brand: string | null;
  stock_uom: string;
  standard_rate: number | null;
  disabled: 0 | 1;
  image: string | null;
  description: string | null;
  is_stock_item: 0 | 1;
  has_variants: 0 | 1;
  weight_per_unit: number | null;
  weight_uom: string | null;
  country_of_origin: string | null;
  creation: string;
  modified: string;
  owner: string;
}

interface BinRow {
  warehouse: string;
  actual_qty: number;
  reserved_qty: number;
  projected_qty: number;
  stock_value: number;
}

interface ItemPriceRow {
  name: string;
  price_list: string;
  price_list_rate: number;
  valid_from: string | null;
}

export default function ItemDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useFrappeGetDoc<ItemDoc>("Item", id);
  const { data: bins } = useFrappeGetDocList<BinRow>("Bin", {
    fields: ["warehouse", "actual_qty", "reserved_qty", "projected_qty", "stock_value"],
    filters: [["item_code", "=", id]],
    limit: 50,
  });
  const { data: prices } = useFrappeGetDocList<ItemPriceRow>("Item Price", {
    fields: ["name", "price_list", "price_list_rate", "valid_from"],
    filters: [["item_code", "=", id]],
    limit: 20,
  });

  const binRows = bins ?? [];
  const totals = binRows.reduce(
    (acc, b) => ({
      actual: acc.actual + (b.actual_qty || 0),
      reserved: acc.reserved + (b.reserved_qty || 0),
      projected: acc.projected + (b.projected_qty || 0),
    }),
    { actual: 0, reserved: 0, projected: 0 },
  );

  const sections: DetailSection[] = data
    ? [
        {
          fields: [
            {
              label: "Stock by warehouse",
              wide: true,
              bare: true,
              value: (
                <div className="-mx-1">
                  <span className="mb-2 block px-1 text-[11px] font-medium tracking-[.08em] text-ash uppercase">
                    Stock by warehouse <span className="font-normal text-ash-2">· Bin</span>
                  </span>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Warehouse</TableHead>
                        <TableHead className="text-right">Actual qty</TableHead>
                        <TableHead className="text-right">Reserved</TableHead>
                        <TableHead className="text-right">Projected</TableHead>
                        <TableHead className="text-right">Stock value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {binRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-6 text-center text-ash">
                            No stock recorded in any warehouse.
                          </TableCell>
                        </TableRow>
                      )}
                      {binRows.map((b) => (
                        <TableRow key={b.warehouse}>
                          <TableCell className="text-ink">{b.warehouse}</TableCell>
                          <TableCell className="text-right tabular-nums">{b.actual_qty}</TableCell>
                          <TableCell className="text-right tabular-nums text-slate">{b.reserved_qty}</TableCell>
                          <TableCell className="text-right tabular-nums">{b.projected_qty}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{formatCurrency(b.stock_value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ),
            },
          ],
        },
        {
          heading: "Description",
          fields: [{ label: "Description", value: data.description || "No description on file.", wide: true }],
        },
        {
          heading: "Specifications",
          fields: [
            { label: "Item Group", value: data.item_group },
            { label: "Stock UOM", value: data.stock_uom },
            { label: "Is Stock Item", value: data.is_stock_item ? "Yes" : "No" },
            { label: "Has Variants", value: data.has_variants ? "Yes" : "No" },
            { label: "Weight per Unit", value: data.weight_per_unit ? `${data.weight_per_unit} ${data.weight_uom ?? ""}`.trim() : "—" },
            { label: "Country of Origin", value: data.country_of_origin ?? "—" },
          ],
        },
        {
          heading: "Item Price",
          fields:
            prices && prices.length > 0
              ? prices.map((p) => ({
                  label: p.price_list,
                  value: (
                    <span>
                      {formatCurrency(p.price_list_rate)}
                      {p.valid_from && <span className="ml-1.5 text-[11px] text-ash-2">from {formatDate(p.valid_from)}</span>}
                    </span>
                  ),
                }))
              : [{ label: "Item Price", value: "No price list entries yet." }],
        },
        {
          heading: "Meta",
          fields: [
            { label: "Owner", value: data.owner },
            { label: "Created", value: formatDate(data.creation) },
            { label: "Last Modified", value: formatDate(data.modified) },
          ],
        },
      ]
    : [];

  return (
    <DetailView
      title={data?.item_name ?? "Loading…"}
      subtitle={data && `${data.item_code} · ${data.item_group}${data.brand ? ` · ${data.brand}` : ""}`}
      backHref="/products"
      backLabel="Products"
      isLoading={isLoading}
      error={error}
      sections={sections}
      leading={
        data &&
        (data.image ? (
          <img src={data.image} alt="" className="size-14 flex-none rounded-[10px] border border-line-subtle object-cover" />
        ) : (
          <div className="flex size-14 flex-none items-center justify-center rounded-[10px] border border-dashed border-line-dashed bg-surface-dashed text-ash-3">
            <ImageIcon className="size-6" />
          </div>
        ))
      }
      actions={
        data && (
          <div className="flex items-center gap-2">
            <Badge variant={data.disabled ? "neutral" : "success"}>{data.disabled ? "Disabled" : "Active"}</Badge>
            <Button variant="outline" className="h-9 gap-[7px] text-[13px]">
              <Printer className="size-[15px] text-slate" />
              Print
            </Button>
            <Button className="h-9 text-[13px] tracking-[.09em] uppercase">Edit item</Button>
          </div>
        )
      }
    >
      {totals.actual > 0 || binRows.length > 0 ? (
        <div className="mb-6 grid grid-cols-4 gap-3">
          {[
            { label: "On hand", value: totals.actual, meta: `across ${binRows.length} warehouse${binRows.length === 1 ? "" : "s"}` },
            { label: "Reserved", value: totals.reserved, meta: "against open sales orders" },
            { label: "Projected", value: totals.projected, meta: "actual + incoming − reserved" },
            { label: "Standard rate", value: formatCurrency(data?.standard_rate) ?? "—", meta: "selling price" },
          ].map((s) => (
            <div key={s.label} className="rounded-[9px] border border-line-subtle bg-background px-4 py-[13px]">
              <div className="text-[11px] font-medium tracking-[.06em] text-ash uppercase">{s.label}</div>
              <div className="mt-2 text-[19px] font-semibold tabular-nums tracking-[-.028em] text-ink">{s.value}</div>
              <div className="mt-1.5 text-[11.5px] text-ash-2">{s.meta}</div>
            </div>
          ))}
        </div>
      ) : null}
    </DetailView>
  );
}
