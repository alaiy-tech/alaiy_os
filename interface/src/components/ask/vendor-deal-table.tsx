"use client";

import { useState } from "react";
import type { EvaluatedRow } from "@/lib/dev/vendor-sheet";

/**
 * The vendor deal analyzer's result, rendered as a real table rather than
 * markdown — the per-row warning annotations (gated, Amazon on the listing, a
 * seller nearly out of stock) don't fit a pipe table, and this is the one
 * answer shape worth a dedicated card for.
 */
export function VendorDealTable({
  fileNames,
  rows,
}: {
  fileNames: string[];
  rows: EvaluatedRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const worthBuying = rows.filter((r) => r.bucket === "worth_buying").sort((a, b) => b.margin - a.margin);
  const notWorthIt = rows.filter((r) => r.bucket === "not_worth_it");
  const unmatched = rows.filter((r) => r.bucket === "unmatched");

  const preview = worthBuying.slice(0, 5);
  const shown = expanded ? [...worthBuying, ...notWorthIt, ...unmatched] : preview;

  function copyCsv() {
    const header = ["Item", "UPC", "Cost", "Sell Price", "Fees", "Net Profit", "Margin", "Status", "Note"];
    const lines = rows.map((r) => [
      r.title,
      r.upc ?? "",
      r.cost.toFixed(2),
      r.price ? r.price.toFixed(2) : "",
      r.price ? (r.referral + r.fulfillment).toFixed(2) : "",
      r.price ? r.netProfit.toFixed(2) : "",
      r.price ? `${Math.round(r.margin * 100)}%` : "",
      r.bucket,
      r.flagDetail ?? "",
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    navigator.clipboard?.writeText(csv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const money = (n: number) => `$${n.toFixed(2)}`;

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-line bg-canvas px-4 py-3">
        <div>
          <p className="text-[13px] font-semibold text-ink">Vendor sheet checked against Amazon</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {fileNames.length ? fileNames.join(", ") : "Sample vendor sheet"}
          </p>
        </div>
        <p className="shrink-0 whitespace-nowrap text-[11px] text-muted">
          {rows.length} rows · {worthBuying.length} worth buying
        </p>
      </div>

      <p className="border-b border-line px-4 py-3 text-[13px] leading-relaxed text-ink">
        Checked <strong className="font-semibold">{rows.length} vendor rows</strong> against your Amazon
        catalog — gating, current buy box price, 15% referral fee, and FBA/shipping cost.{" "}
        <strong className="font-semibold text-ok-ink">{worthBuying.length} are profitable</strong> and
        approved to sell; <strong className="font-semibold">{notWorthIt.length}</strong> are blocked or
        break even; <strong className="font-semibold">{unmatched.length}</strong> didn&apos;t match
        anything in your catalog.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {["Item", "UPC", "Cost", "Sell price", "Fees", "Net profit", "Margin"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap border-b border-line bg-surface px-3 py-2 font-sans text-[10.5px] font-semibold uppercase tracking-[0.1em] text-primary-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, i) => (
              <tr key={i} className={row.bucket !== "worth_buying" ? "opacity-70" : undefined}>
                <td className="max-w-[220px] border-b border-line/60 px-3 py-2 align-top">
                  <p className="text-[13px] font-medium text-ink">{row.title}</p>
                  {row.flagDetail ? (
                    <p className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-warn-ink">
                      <svg viewBox="0 0 16 16" aria-hidden className="mt-[1px] h-3 w-3 shrink-0" fill="currentColor">
                        <path d="M8 1.5 15 14H1L8 1.5Zm0 4.5v4M8 11.5h.01" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                      </svg>
                      {row.flagDetail}
                    </p>
                  ) : null}
                </td>
                <td className="whitespace-nowrap border-b border-line/60 px-3 py-2 align-top font-data text-[12px] text-muted">
                  {row.upc ?? "—"}
                </td>
                <td className="whitespace-nowrap border-b border-line/60 px-3 py-2 align-top font-data text-[12px] text-ink">
                  {money(row.cost)}
                </td>
                <td className="whitespace-nowrap border-b border-line/60 px-3 py-2 align-top font-data text-[12px] text-ink">
                  {row.price ? money(row.price) : "—"}
                </td>
                <td className="whitespace-nowrap border-b border-line/60 px-3 py-2 align-top font-data text-[12px] text-muted">
                  {row.price ? money(row.referral + row.fulfillment) : "—"}
                </td>
                <td
                  className={`whitespace-nowrap border-b border-line/60 px-3 py-2 align-top font-data text-[12px] font-medium ${
                    row.price && row.netProfit > 0 ? "text-ok-ink" : "text-muted"
                  }`}
                >
                  {row.price ? money(row.netProfit) : "—"}
                </td>
                <td className="whitespace-nowrap border-b border-line/60 px-3 py-2 align-top font-data text-[12px] text-ink">
                  {row.price ? `${Math.round(row.margin * 100)}%` : "unmatched"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 border-t border-line bg-canvas px-4 py-2.5">
        {rows.length > preview.length ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink hover:border-primary-300"
          >
            {expanded ? "Show top picks only" : `Open full list (${rows.length})`}
          </button>
        ) : null}
        <button
          type="button"
          onClick={copyCsv}
          className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink hover:border-primary-300"
        >
          {copied ? "Copied" : "Copy as CSV"}
        </button>
      </div>
    </div>
  );
}
