import { getSession } from "@/lib/auth/dal";
import { EXPORT_LIMIT, listOrders } from "@/lib/backend/orders";
import { flagPresentation } from "@/lib/orders/flags";
import {
  firstValue,
  parseAmount,
  parseChannel,
  parseFlag,
  parseFulfilment,
  parseWindow,
  windowStart,
} from "@/lib/listing";
import type { ChannelOrder } from "@/lib/backend/types";

/**
 * The Orders tab's filtered view, as a CSV.
 *
 * Same-origin, like every other call the browser makes: this handler talks to
 * os.alaiy.com, the browser talks only to this. It reads the *same query
 * parameters the page does*, through the same parsers — so the file is what is
 * on screen, and a seller who narrowed to "Amazon, not shipped" gets those
 * rows and no others rather than a fresh dump they have to filter again.
 *
 * The grain is the order, matching the table. A per-line export would be a
 * different and equally reasonable file; it is not this one, and the header
 * row says which it is.
 */

const COLUMNS: { header: string; value: (order: ChannelOrder) => string }[] = [
  { header: "Flags", value: (o) => o.flags.map(label).join(", ") },
  { header: "Needs attention", value: (o) => (o.needs_attention ? "yes" : "no") },
  { header: "Channel", value: (o) => o.channel },
  { header: "Order date", value: (o) => o.order_date ?? "" },
  { header: "Order number", value: (o) => o.order_number ?? "" },
  { header: "Channel order id", value: (o) => o.external_order_id },
  { header: "Customer", value: (o) => o.customer_name ?? "" },
  { header: "SKUs", value: (o) => o.skus.join(", ") },
  { header: "Lines", value: (o) => String(o.line_count ?? "") },
  { header: "Units", value: (o) => String(o.units ?? "") },
  { header: "Currency", value: (o) => o.currency ?? "" },
  { header: "Order total", value: (o) => String(o.order_total ?? "") },
  { header: "Merchandise total", value: (o) => String(o.merchandise_total ?? "") },
  { header: "Payment status", value: (o) => o.financial_status ?? "" },
  { header: "Fulfilment status", value: (o) => o.fulfillment_status ?? "" },
  { header: "Order status", value: (o) => o.order_status ?? "" },
  { header: "Last synced", value: (o) => o.last_synced_at ?? "" },
  { header: "Channel link", value: (o) => o.external_url ?? "" },
];

function label(flag: ChannelOrder["flags"][number]): string {
  return flagPresentation(flag)?.label ?? flag;
}

/**
 * One CSV cell.
 *
 * The leading-character guard is not paranoia about our own data: a customer
 * name or a product title comes from whoever typed it into a storefront, and a
 * cell beginning `=` or `@` is a formula the moment this file is opened in
 * Excel. Prefixing an apostrophe is the standard defusal. A leading `-` is
 * deliberately left alone, so a negative amount stays a number.
 */
function cell(value: string): string {
  const safe = /^[=+@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const read = (key: string) => params.get(key) ?? undefined;

  const window = parseWindow(read("window"));
  const { page, error } = await listOrders(
    {
      channel: parseChannel(read("channel")),
      search: firstValue(read("q")),
      flag: parseFlag(read("flag")),
      fulfilment: parseFulfilment(read("fulfilment")),
      minAmount: parseAmount(read("min")),
      maxAmount: parseAmount(read("max")),
      fromDate: windowStart(window),
      limit: EXPORT_LIMIT,
    },
    session.backendToken,
  );

  if (error) {
    return Response.json({ error: "orders_export_failed" }, { status: 502 });
  }

  const lines = [
    COLUMNS.map((column) => cell(column.header)).join(","),
    ...page.rows.map((order) =>
      COLUMNS.map((column) => cell(column.value(order))).join(","),
    ),
  ];

  // A BOM, so Excel reads this as UTF-8 rather than mangling ₹ and every name
  // that is not ASCII. \r\n because that is what RFC 4180 says a CSV line is,
  // and what the spreadsheet on the other end is least surprised by.
  const body = `﻿${lines.join("\r\n")}\r\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename(page.total, page.rows.length)}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * The filename, which is also where truncation is admitted.
 *
 * A cap has to exist somewhere, and the honest place to say it is the name of
 * the file — not a header nobody reads, and certainly not a row appended to
 * the data, which would corrupt the thing being exported.
 */
function filename(total: number, exported: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const suffix = exported < total ? `-first-${exported}-of-${total}` : "";
  return `alaiy-orders-${today}${suffix}.csv`;
}
