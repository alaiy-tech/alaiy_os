import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFrappeAuth } from "frappe-react-sdk";
import { Download, IndianRupee, Receipt, ShoppingCart, Truck } from "lucide-react";

import { formatINRCompact, formatINRFull } from "@/lib/format";
import { areaPath, linePath } from "@/lib/svg-path";
import { series } from "@/lib/seeded-series";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const RANGE_TABS = ["7D", "30D", "QTD", "YTD"];

const KPI_DEFS = [
  { label: "GMV today", value: formatINRCompact(48920000), delta: "+8.4%", up: true, icon: IndianRupee, seed: 3, base: 3.9e7 },
  { label: "Orders today", value: "3,914", delta: "+312", up: true, icon: ShoppingCart, seed: 11, base: 3400 },
  { label: "Avg order value", value: formatINRFull(12498), delta: "−1.2%", up: false, icon: Receipt, seed: 23, base: 12600 },
  { label: "On-time fulfilment", value: "94.1%", delta: "+0.7 pt", up: true, icon: Truck, seed: 31, base: 93 },
];

const PIPELINE = [
  { label: "Draft", count: 214, raw: 21400000, pct: 12, color: "#C9C2B6" },
  { label: "To Deliver and Bill", count: 1842, raw: 184600000, pct: 100, color: "#003254" },
  { label: "To Bill", count: 736, raw: 72900000, pct: 40, color: "#4F86A8" },
  { label: "To Deliver", count: 498, raw: 49100000, pct: 27, color: "#91D1F2" },
  { label: "On Hold", count: 63, raw: 8200000, pct: 5, color: "#D9A94C" },
];

const TOP_ITEMS = [
  { name: "Nordic Oak Dining Table 180cm", revenue: 31400000, delta: "+14%", up: true, pct: 100 },
  { name: "Linen Sectional Sofa — Ash", revenue: 26800000, delta: "+9%", up: true, pct: 85 },
  { name: "Brass Pendant Light (set of 3)", revenue: 19200000, delta: "−4%", up: false, pct: 61 },
  { name: "Walnut Office Desk 140cm", revenue: 16500000, delta: "+22%", up: true, pct: 52 },
  { name: "Cotton Percale Bedding Set — Queen", revenue: 12900000, delta: "+3%", up: true, pct: 41 },
];

const ATTENTION = [
  { id: "SAL-ORD-2026-04412", customer: "Havelock Retail Pvt Ltd", issue: "Stock shortfall", tone: "danger" as const, age: "6 d", value: 1842000 },
  { id: "SAL-ORD-2026-04388", customer: "Kanan Home Supplies", issue: "Credit limit exceeded", tone: "danger" as const, age: "4 d", value: 964500 },
  { id: "SAL-ORD-2026-04361", customer: "Meridian Interiors LLP", issue: "On Hold", tone: "warning" as const, age: "3 d", value: 2410000 },
  { id: "SAL-ORD-2026-04309", customer: "Oakfield Contract Furnishing", issue: "Awaiting payment", tone: "warning" as const, age: "9 d", value: 587300 },
  { id: "SAL-ORD-2026-04277", customer: "Bluewater Hospitality Group", issue: "Draft > 7 days", tone: "neutral" as const, age: "11 d", value: 1329000 },
];

const HOURLY = [180, 120, 78, 52, 44, 61, 118, 236, 344, 402, 448, 470, 492, 516, 604, 638, 571, 498, 432, 388, 342, 296, 244, 201];

export default function DashboardHome() {
  const { currentUser } = useFrappeAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState("30D");

  const rev = useMemo(() => series(7, 30, 11000000, 0.011, 3400000), []);
  const ord = useMemo(() => series(19, 30, 3100, 0.008, 1050), []);
  const openTotal = PIPELINE.reduce((a, p) => a + p.raw, 0);
  const hmax = Math.max(...HOURLY);
  const hourlyAvg = HOURLY.map((v, i) => v * (i > 12 ? 0.9 : 1.12));

  return (
    <div className="max-w-[1440px] px-8 pt-7 pb-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-[12.5px] font-medium tracking-[.02em] text-ash">Welcome back, {currentUser?.split("@")[0] ?? "there"}</div>
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-[-.025em] text-ink">Operations overview</h1>
          <p className="mt-[5px] text-[13px] text-slate">
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · demo
            data — not yet wired to a live analytics backend
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-line">
            {RANGE_TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRange(t)}
                className={`h-[34px] px-[13px] text-[12.5px] font-medium transition-colors ${t === range ? "bg-navy text-white" : "text-slate-3 hover:bg-paper"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <Button variant="outline" className="h-[34px] gap-[7px] text-[13px]">
            <Download className="size-[15px] text-slate" />
            Export
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-3.5">
        {KPI_DEFS.map((k) => {
          const s = series(k.seed, 16, k.base, 0.006, k.base * 0.13);
          return (
            <div key={k.label} className="rounded-[10px] border border-line-subtle bg-background px-[18px] py-4 pb-3.5 transition-shadow hover:shadow-[0_6px_20px_rgba(0,20,36,.055)]">
              <div className="flex items-center gap-2 text-slate">
                <k.icon className="size-[15px] text-ash-2" />
                <span className="text-[11.5px] font-medium tracking-[.06em] uppercase">{k.label}</span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[27px] leading-none font-semibold tracking-[-.035em] tabular-nums text-ink">{k.value}</div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className={`text-[12.5px] font-semibold tabular-nums tracking-[-.01em] ${k.up ? "text-success-fg" : "text-danger-fg"}`}>
                      {k.delta}
                    </span>
                    <span className="text-[11.5px] text-ash-2">vs yesterday</span>
                  </div>
                </div>
                <svg width={86} height={34} viewBox="0 0 86 34" className="flex-none overflow-visible">
                  <path d={areaPath(s, 86, 34, 4)} fill={k.up ? "rgba(21,128,61,.09)" : "rgba(180,35,42,.08)"} />
                  <path d={linePath(s, 86, 34, 4)} fill="none" stroke={k.up ? "#15803D" : "#B4232A"} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2.05fr_1fr]">
        <div className="rounded-[10px] border border-line-subtle bg-background p-5 pb-3.5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[14.5px] font-semibold tracking-[-.012em] text-ink">Revenue &amp; order volume</div>
              <div className="mt-[3px] text-[12px] text-ash">Net of returns · last 30 days</div>
            </div>
            <div className="flex gap-4">
              <div>
                <div className="text-[11px] tracking-[.05em] text-ash-2 uppercase">Revenue</div>
                <div className="mt-[3px] text-[16px] font-semibold tracking-[-.02em] tabular-nums">₹41.8 Cr</div>
              </div>
              <div>
                <div className="text-[11px] tracking-[.05em] text-ash-2 uppercase">Orders</div>
                <div className="mt-[3px] text-[16px] font-semibold tracking-[-.02em] tabular-nums">108,417</div>
              </div>
            </div>
          </div>
          <div className="mt-[18px]">
            <svg viewBox="0 0 760 210" width="100%" height={210} preserveAspectRatio="none" className="block overflow-visible">
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1={0} x2={760} y1={i * (210 / 4)} y2={i * (210 / 4)} stroke="#F1EDE6" strokeWidth={1} />
              ))}
              <path d={areaPath(rev, 760, 210, 12)} fill="rgba(0,50,84,.07)" />
              <path d={linePath(rev, 760, 210, 12)} fill="none" stroke="#003254" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <path d={linePath(ord, 760, 210, 26)} fill="none" stroke="#91D1F2" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <div className="mt-2.5 flex justify-between text-[11px] tabular-nums text-ash-2">
              {["6 Jul", "12 Jul", "18 Jul", "24 Jul", "30 Jul", "4 Aug"].map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
            <div className="mt-3 flex gap-[18px] border-t border-line-faint pt-3">
              <div className="flex items-center gap-[7px] text-[12px] text-slate">
                <span className="h-0.5 w-3.5 rounded-full bg-navy" />
                Revenue
              </div>
              <div className="flex items-center gap-[7px] text-[12px] text-slate">
                <span className="h-0.5 w-3.5 rounded-full bg-blue" />
                Orders
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[10px] border border-line-subtle bg-background p-5">
          <div className="text-[14.5px] font-semibold tracking-[-.012em] text-ink">Fulfilment pipeline</div>
          <div className="mt-[3px] text-[12px] text-ash">Open sales orders by stage</div>
          <div className="mt-5 flex flex-col gap-[15px]">
            {PIPELINE.map((p) => (
              <div key={p.label}>
                <div className="flex items-baseline justify-between gap-2.5">
                  <span className="text-[12.5px] font-medium text-ink">{p.label}</span>
                  <span className="text-[12.5px] font-semibold tabular-nums tracking-[-.01em] text-ink">{p.count.toLocaleString("en-IN")}</span>
                </div>
                <div className="mt-[7px] h-1.5 overflow-hidden rounded-full bg-chart-track">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${p.pct}%`, background: p.color }} />
                </div>
                <div className="mt-[5px] text-[11px] tabular-nums text-ash-2">
                  {formatINRCompact(p.raw)} · {Math.round((p.raw / openTotal) * 100)}% of open value
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-[10px] border border-line-subtle bg-background p-5 pb-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[14.5px] font-semibold tracking-[-.012em] text-ink">Order intake by hour</div>
              <div className="mt-[3px] text-[12px] text-ash">Today vs 7-day average · peak 14:00–16:00</div>
            </div>
            <Badge variant="success">3,914 today</Badge>
          </div>
          <svg viewBox="0 0 720 150" width="100%" height={150} preserveAspectRatio="none" className="mt-5 block overflow-visible">
            {HOURLY.map((v, i) => {
              const bh = (v / hmax) * 138;
              return <rect key={i} x={i * 30 + 4} y={150 - bh} width={20} height={bh} rx={3} fill={i >= 14 && i <= 16 ? "#003254" : "#DCE9F1"} />;
            })}
            <path d={linePath(hourlyAvg, 720, 150, 12)} fill="none" stroke="#003254" strokeWidth={1.6} strokeDasharray="4 4" strokeLinejoin="round" />
          </svg>
          <div className="mt-[9px] flex justify-between text-[11px] tabular-nums text-ash-2">
            {["00", "04", "08", "12", "16", "20", "23"].map((h) => (
              <span key={h}>{h}</span>
            ))}
          </div>
        </div>

        <div className="rounded-[10px] border border-line-subtle bg-background p-5 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14.5px] font-semibold tracking-[-.012em] text-ink">Top items by revenue</div>
              <div className="mt-[3px] text-[12px] text-ash">Last 30 days</div>
            </div>
            <button type="button" onClick={() => navigate("/products")} className="px-0.5 py-1 text-[12.5px] font-medium text-navy hover:underline hover:decoration-blue hover:decoration-2 hover:underline-offset-[3px]">
              View all
            </button>
          </div>
          <div className="mt-3.5">
            {TOP_ITEMS.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3 border-b border-line-faint py-[9px] last:border-0">
                <span className="w-5 text-[11.5px] tabular-nums text-ash-2">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium tracking-[-.01em] text-ink">{t.name}</div>
                  <div className="mt-1 h-1 max-w-[220px] overflow-hidden rounded-full bg-chart-track">
                    <div className="h-full rounded-full bg-navy" style={{ width: `${t.pct}%` }} />
                  </div>
                </div>
                <div className="flex-none text-right">
                  <div className="text-[13px] font-semibold tracking-[-.015em] tabular-nums">{formatINRCompact(t.revenue)}</div>
                  <div className={`mt-[3px] text-[11.5px] font-medium tabular-nums ${t.up ? "text-success-fg" : "text-danger-fg"}`}>{t.delta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[10px] border border-line-subtle bg-background">
        <div className="flex items-center justify-between border-b border-line-faint px-[22px] py-4">
          <div>
            <div className="text-[14.5px] font-semibold tracking-[-.012em] text-ink">Needs attention</div>
            <div className="mt-[3px] text-[12px] text-ash">Sales orders blocked, overdue or short on stock</div>
          </div>
          <Button variant="outline" className="h-8 text-[12.5px]" onClick={() => navigate("/sales-orders")}>
            Open Sales Order list
          </Button>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["Order", "Customer", "Issue", "Age", "Value"].map((h, i) => (
                <th key={h} className={`bg-surface-faint px-[22px] py-[10px] text-[11px] font-medium tracking-[.06em] text-ash uppercase ${i === 4 ? "text-right" : "text-left"} ${i > 0 && i < 4 ? "px-3" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ATTENTION.map((a) => (
              <tr key={a.id} onClick={() => navigate("/sales-orders")} className="cursor-pointer border-b border-line-faint transition-colors last:border-0 hover:bg-surface-faint">
                <td className="px-[22px] py-[11px] font-medium tracking-[-.01em] text-navy tabular-nums">{a.id}</td>
                <td className="px-3 py-[11px] text-ink">{a.customer}</td>
                <td className="px-3 py-[11px]">
                  <Badge variant={a.tone}>{a.issue}</Badge>
                </td>
                <td className="px-3 py-[11px] text-[12.5px] tabular-nums text-slate">{a.age}</td>
                <td className="px-[22px] py-[11px] text-right font-semibold tabular-nums tracking-[-.015em]">{formatINRFull(a.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
