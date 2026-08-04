import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useFrappeGetDoc, useFrappeGetDocList } from "frappe-react-sdk";
import { Sparkles } from "lucide-react";

import { DetailView, type DetailSection } from "@/components/data/DetailView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAskPanel } from "@/contexts/ask-panel-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { statusTone } from "@/lib/status";
import { areaPath, linePath } from "@/lib/svg-path";
import { Clock, Users2 } from "lucide-react";

interface CustomerDoc {
  name: string;
  customer_name: string;
  customer_type: string;
  customer_group: string;
  territory: string;
  default_currency: string | null;
  default_price_list: string | null;
  payment_terms: string | null;
  tax_id: string | null;
  loyalty_program: string | null;
  disabled: 0 | 1;
  owner: string;
  creation: string;
}

interface OrderRow {
  name: string;
  transaction_date: string;
  grand_total: number;
  status: string;
}

function initials(value: string) {
  return value.split(" ").slice(0, 2).map((w) => w[0]).join("");
}

const CHART_W = 640;
const CHART_H = 150;

export default function CustomerDetailPage() {
  const { id = "" } = useParams();
  const { open: openAsk } = useAskPanel();
  const [tab, setTab] = useState("overview");
  const { data, isLoading, error } = useFrappeGetDoc<CustomerDoc>("Customer", id);

  const oneYearAgo = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const { data: orders } = useFrappeGetDocList<OrderRow>("Sales Order", {
    fields: ["name", "transaction_date", "grand_total", "status"],
    filters: [
      ["customer", "=", id],
      ["transaction_date", ">=", oneYearAgo],
    ],
    orderBy: { field: "transaction_date", order: "desc" },
    limit: 200,
  });
  const { data: outstandingInvoices } = useFrappeGetDocList<{ outstanding_amount: number }>("Sales Invoice", {
    fields: ["outstanding_amount"],
    filters: [
      ["customer", "=", id],
      ["outstanding_amount", ">", 0],
    ],
    limit: 200,
  });

  const orderList = orders ?? [];
  const revenue12m = orderList.reduce((a, o) => a + o.grand_total, 0);
  const outstanding = (outstandingInvoices ?? []).reduce((a, i) => a + i.outstanding_amount, 0);

  const monthly = useMemo(() => {
    const buckets = new Map<string, number>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
    }
    (orders ?? []).forEach((o) => {
      const d = new Date(o.transaction_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + o.grand_total);
    });
    return Array.from(buckets.entries()).map(([key, value]) => ({
      label: new Date(Number(key.split("-")[0]), Number(key.split("-")[1]), 1).toLocaleDateString(undefined, { month: "short" }),
      value,
    }));
  }, [orders]);

  const sections: DetailSection[] = data
    ? [
        {
          heading: "Account detail",
          fields: [
            { label: "Customer ID", value: data.name },
            { label: "Customer group", value: data.customer_group },
            { label: "Territory", value: data.territory },
            { label: "Customer type", value: data.customer_type },
            { label: "Default currency", value: data.default_currency ?? "—" },
            { label: "Price list", value: data.default_price_list ?? "—" },
            { label: "Payment terms", value: data.payment_terms ?? "—" },
            { label: "Tax ID", value: data.tax_id ?? "—" },
            { label: "Loyalty program", value: data.loyalty_program ?? "—" },
          ],
        },
      ]
    : [];

  return (
    <DetailView
      title={data?.customer_name ?? "Loading…"}
      subtitle={data && `Customer since ${formatDate(data.creation)} · owner ${data.owner}`}
      backHref="/customers"
      backLabel="Customer"
      isLoading={isLoading}
      error={error}
      leading={
        data && (
          <span className="flex size-14 flex-none items-center justify-center rounded-full bg-navy text-[17px] font-semibold tracking-[.01em] text-white">
            {initials(data.customer_name)}
          </span>
        )
      }
      actions={
        data && (
          <div className="flex flex-none gap-2">
            <Button variant="outline" className="h-9 gap-[7px] text-[13px]" onClick={() => openAsk(data.customer_name)}>
              <Sparkles className="size-[15px] text-navy" />
              Summarise account
            </Button>
            <Button className="h-9 text-[13px] tracking-[.09em] uppercase">New sales order</Button>
          </div>
        )
      }
      sections={[]}
    >
      {data && (
        <>
          <div className="mb-2 flex flex-wrap gap-[7px]">
            {[data.customer_group, data.territory, data.customer_type, data.disabled ? "Disabled" : "Active"].map((t) => (
              <span key={t} className="rounded-full border border-tag-border bg-tag-bg px-[10px] py-[3px] text-[11.5px] font-medium text-tag">
                {t}
              </span>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-4 gap-3">
            {[
              { label: "Revenue 12m", value: formatCurrency(revenue12m, data.default_currency ?? undefined) },
              { label: "Orders 12m", value: orderList.length.toLocaleString("en-IN") },
              { label: "Avg order value", value: formatCurrency(orderList.length ? revenue12m / orderList.length : 0, data.default_currency ?? undefined) },
              { label: "Outstanding", value: formatCurrency(outstanding, data.default_currency ?? undefined) },
            ].map((s) => (
              <div key={s.label} className="rounded-[9px] border border-line-subtle bg-background px-4 py-[13px]">
                <div className="text-[11px] font-medium tracking-[.06em] text-ash uppercase">{s.label}</div>
                <div className="mt-2 text-[19px] font-semibold tabular-nums tracking-[-.03em] text-ink">{s.value}</div>
              </div>
            ))}
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-5 gap-1 border-b border-line-subtle">
              {[
                { value: "overview", label: "Overview" },
                { value: "orders", label: "Orders" },
                { value: "contacts", label: "Contacts & addresses" },
                { value: "activity", label: "Activity" },
              ].map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-[1.6fr_1fr]">
              <div className="flex flex-col gap-[18px]">
                <div className="rounded-[10px] border border-line-subtle bg-background p-5">
                  <div className="text-[14px] font-semibold tracking-[-.014em] text-ink">Revenue &amp; order count</div>
                  <p className="mt-1 text-[12px] text-ash">Rolling 12 months</p>
                  <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%" height={CHART_H} preserveAspectRatio="none" className="mt-4 block overflow-visible">
                    <path d={areaPath(monthly.map((m) => m.value), CHART_W, CHART_H, 10)} fill="rgba(0,50,84,.07)" />
                    <path d={linePath(monthly.map((m) => m.value), CHART_W, CHART_H, 10)} fill="none" stroke="#003254" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                  <div className="mt-2.5 flex justify-between text-[11px] text-ash-2">
                    {monthly.filter((_, i) => i % 2 === 0).map((m, i) => (
                      <span key={i}>{m.label}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded-[10px] border border-line-subtle bg-background p-0">
                  <div className="border-b border-line-faint px-[18px] py-[14px] text-[14px] font-semibold tracking-[-.014em] text-ink">
                    Recent sales orders
                  </div>
                  <Table>
                    <TableBody>
                      {orderList.slice(0, 5).map((o) => (
                        <TableRow key={o.name}>
                          <TableCell className="font-medium tracking-[-.012em] text-navy tabular-nums">{o.name}</TableCell>
                          <TableCell className="text-[12.5px] tabular-nums text-slate">{formatDate(o.transaction_date)}</TableCell>
                          <TableCell>
                            <Badge variant={statusTone(o.status)}>{o.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(o.grand_total)}</TableCell>
                        </TableRow>
                      ))}
                      {orderList.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-ash">
                            No orders in the last 12 months.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="rounded-[10px] border border-line-subtle bg-background p-[18px]">
                <div className="text-[11px] font-medium tracking-[.08em] text-ash uppercase">Account detail</div>
                <div className="mt-3 flex flex-col">
                  {sections[0]?.fields.map((f) => (
                    <div key={f.label} className="flex items-baseline justify-between gap-4 border-b border-line-faint py-[7px] last:border-0">
                      <span className="text-[12.5px] text-ash">{f.label}</span>
                      <dd className="text-[12.5px] font-medium tabular-nums text-ink">{f.value}</dd>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="orders">
              <div className="rounded-[10px] border border-line-subtle bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderList.map((o) => (
                      <TableRow key={o.name}>
                        <TableCell className="font-medium tracking-[-.012em] text-navy tabular-nums">{o.name}</TableCell>
                        <TableCell className="text-[12.5px] tabular-nums text-slate">{formatDate(o.transaction_date)}</TableCell>
                        <TableCell>
                          <Badge variant={statusTone(o.status)}>{o.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(o.grand_total)}</TableCell>
                      </TableRow>
                    ))}
                    {orderList.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-ash">
                          No orders in the last 12 months.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="contacts">
              <Empty className="rounded-[10px] border border-dashed border-line-dashed py-16">
                <EmptyMedia variant="icon">
                  <Users2 />
                </EmptyMedia>
                <EmptyTitle>Contacts &amp; addresses aren't wired yet</EmptyTitle>
                <EmptyDescription>
                  Frappe links these via Dynamic Link records rather than a direct field on Customer - a small follow-up, not built in
                  this read-only pass.
                </EmptyDescription>
              </Empty>
            </TabsContent>

            <TabsContent value="activity">
              <Empty className="rounded-[10px] border border-dashed border-line-dashed py-16">
                <EmptyMedia variant="icon">
                  <Clock />
                </EmptyMedia>
                <EmptyTitle>Activity timeline isn't wired yet</EmptyTitle>
                <EmptyDescription>This will read Frappe's document version history once built - not fabricated here.</EmptyDescription>
              </Empty>
            </TabsContent>
          </Tabs>
        </>
      )}
    </DetailView>
  );
}
