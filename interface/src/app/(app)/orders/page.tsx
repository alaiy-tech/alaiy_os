import Link from "next/link";
import { requireOnboardedSession } from "@/lib/auth/dal";
import {
  EXPORT_LIMIT,
  ORDER_SORT_FIELDS,
  PAGE_SIZE,
  getOrderDetail,
  listOrders,
  type OrderSortField,
} from "@/lib/backend/orders";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import {
  WINDOW_OPTIONS,
  firstValue,
  listingHref,
  parseAmount,
  parseChannel,
  parseDirection,
  parseFlag,
  parseFulfilment,
  parseOffset,
  parseSelectedOrder,
  hrefToString,
  parseSortField,
  parseWindow,
  selectedOrderKey,
  windowStart,
  type ListingQuery,
} from "@/lib/listing";
import {
  ChannelBadge,
  EmptyRow,
  FlagChips,
  SortableTh,
  StatusText,
  TableFrame,
  Td,
  Th,
} from "@/components/data/table";
import { ChannelTabs } from "@/components/data/channel-tabs";
import { LIVE_CHANNELS } from "@/lib/channels";
import { Pagination } from "@/components/data/pagination";
import { Figure, TotalsBar } from "@/components/data/summary";
import {
  FilterField,
  FilterInput,
  FilterSelect,
  Toolbar,
} from "@/components/data/toolbar";
import { Alert, Eyebrow, pressClass } from "@/components/ui";
import {
  ChannelAdminLink,
  SellerCentralLink,
} from "@/components/channel/seller-central-link";
import { ImportingBanner } from "@/components/data/importing-banner";
import { isImporting, loadCurrentImport } from "@/lib/backend/imports";
import { FLAG_FILTER_OPTIONS } from "@/lib/orders/flags";
import { FlagRules } from "@/app/(app)/orders/flag-rules";
import { OrderPanel } from "@/app/(app)/orders/order-panel";
import { ClickableRow } from "@/components/data/clickable-row";

export const metadata = { title: "Orders — Alaiy" };

const PATH = "/orders";

const FULFILMENT_OPTIONS = [
  { value: "", label: "Any" },
  { value: "fba", label: "Amazon FBA" },
  { value: "merchant", label: "You ship it" },
];

/**
 * The Orders tab: every order from every channel, problems first.
 *
 * A row is one *order*, grouped from its lines by the backend. Grouping there
 * rather than here is what makes the ranking, the pager and the totals all
 * describe the same set — an order's lines straddle a page boundary, so a page
 * of lines grouped in this process would show half an order at the bottom of
 * it and rank "problems first" across only the fifty rows that arrived.
 *
 * The flags are the one vocabulary the two channels share. Their raw statuses
 * are still shown exactly as sent — Shopify's words and Amazon's do not line
 * up, and Amazon's fulfilment field is actually AFN/MFN — but "not shipped"
 * and "payment pending" are ours, defined once in the backend's order_flags,
 * and mean the same thing on both sides. That is why there is a flag filter
 * and still no status filter.
 *
 * Everything stays in the URL, including which order is open: a filtered,
 * sorted view with one order expanded is a link a seller can send to whoever
 * is dealing with it.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireOnboardedSession();
  const params = await searchParams;

  const channel = parseChannel(params.channel);
  const search = firstValue(params.q);
  const flag = parseFlag(params.flag);
  const fulfilment = parseFulfilment(params.fulfilment);
  const minAmount = parseAmount(params.min);
  const maxAmount = parseAmount(params.max);
  const window = parseWindow(params.window);
  const fromDate = windowStart(window);
  const sort = parseSortField<OrderSortField>(
    params.sort,
    ORDER_SORT_FIELDS,
    "attention",
  );
  const dir = parseDirection(params.dir);
  const start = parseOffset(params.start);
  const selectedKey = firstValue(params.order);
  const selected = parseSelectedOrder(params.order);

  const [{ page, error }, currentImport, detail] = await Promise.all([
    listOrders(
      {
        channel,
        search,
        flag,
        fulfilment,
        minAmount,
        maxAmount,
        fromDate,
        start,
        orderBy: sort,
        order: dir,
      },
      session.backendToken,
    ),
    // Cached, so this is the call the layout already made for the status box.
    loadCurrentImport(session.workspaceId, session.backendToken),
    selected
      ? getOrderDetail(selected.channel, selected.externalOrderId, session.backendToken)
      : Promise.resolve(null),
  ]);

  const query: ListingQuery = {
    q: search,
    channel,
    window,
    sort,
    dir,
    start,
    flag,
    fulfilment,
    min: minAmount === undefined ? undefined : String(minAmount),
    max: maxAmount === undefined ? undefined : String(maxAmount),
    order: selectedKey,
  };

  const filtered = Boolean(
    search || channel || flag || fulfilment || minAmount !== undefined || maxAmount !== undefined,
  );

  const sortHref = (field: OrderSortField) =>
    listingHref(PATH, query, {
      sort: field,
      // "attention" is a ranking, not a column: there is no ascending order of
      // "how wrong is this", so it does not toggle.
      dir: field === "attention" ? "desc" : sort === field && dir === "desc" ? "asc" : "desc",
      start: 0,
      // A re-sort moves the row the panel was opened from, and quite possibly
      // off this page. Closing it is the honest response.
      order: undefined,
    });

  const heading = (field: OrderSortField) => ({
    href: sortHref(field),
    active: sort === field,
    direction: sort === field ? dir : ("desc" as const),
  });

  const windowLabel =
    WINDOW_OPTIONS.find((option) => option.value === window)?.label ?? "";

  const { totals, rules } = page;
  const attentionHref = listingHref(PATH, query, {
    flag: flag === "attention" ? undefined : "attention",
    start: 0,
    order: undefined,
  });

  const exportQuery = new URLSearchParams(listingHref(PATH, query, { start: 0 }).query);
  exportQuery.delete("order");
  exportQuery.delete("sort");
  exportQuery.delete("dir");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your data</Eyebrow>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-display-md">Orders</h1>
          <SellerCentralLink
            href={page.seller_central}
            label="Open Manage Orders in Seller Central"
            size="md"
            className="ml-auto"
          >
            Seller Central
          </SellerCentralLink>
        </div>
        <p className="text-[13px] text-muted">
          {windowLabel.toLowerCase()}, across every connected channel. One row
          per order, and anything that needs attention is at the top.
        </p>
      </div>

      {isImporting(currentImport) ? (
        <ImportingBanner job={currentImport} />
      ) : null}

      <ChannelTabs
        label="Filter by channel"
        active={channel ?? ""}
        tabs={[
          { value: "", label: "All", href: channelHref(query, undefined) },
          ...LIVE_CHANNELS.map((c) => ({
            value: c.id,
            label: c.name,
            href: channelHref(query, c.id),
          })),
        ]}
      />

      <TotalsBar>
        <Figure value={formatNumber(totals.orders)} label="orders" />
        <Figure value={formatNumber(totals.units)} label="units" />
        <Figure
          value={formatMoney(totals.order_value, totals.currency)}
          label="order value"
          // Not the same measure as Home's GMV, and the tooltip says so rather
          // than leaving a seller to find two different numbers for one week
          // and wonder which one is lying.
          title="Order totals as each channel reported them, tax and shipping included. Home's GMV tile sums merchandise value across order lines, so the two differ."
        />
        {totals.mixed_currencies ? (
          <p className="text-[12px] text-warn-ink" title={currencyBreakdown(totals)}>
            Money shown in {totals.currency} only — this view holds{" "}
            {totals.by_currency.length} currencies.
          </p>
        ) : null}

        {/* A count and a filter in one. The number is the reason to come to
            this tab, so it should also be the way into it — and it counts the
            channel, period and search rather than the flag filter, so using it
            does not change it. */}
        <Link
          href={attentionHref}
          title="Orders needing attention in this channel and period, whichever flag is being shown."
          className={`ml-auto rounded-xs border px-2.5 py-1 text-[12px] font-medium transition-colors ${
            totals.attention
              ? "border-alert/40 bg-alert-soft text-alert-ink hover:border-alert"
              : "border-ok/30 bg-ok-soft text-ok-ink hover:border-ok"
          }`}
        >
          {!totals.attention
            ? "Nothing needs attention"
            : flag === "attention"
              ? `Showing ${formatNumber(totals.attention)} that need attention`
              : `${formatNumber(totals.attention)} need attention`}
        </Link>
      </TotalsBar>

      {error ? <Alert>{error}</Alert> : null}

      <Toolbar
        action={PATH}
        sort={sort}
        dir={dir}
        filtered={filtered}
            // Clearing the bar leaves the channel tab alone: it is a tab, not one
        // of the filters this button is beside.
        clearHref={listingHref(PATH, { channel, window, sort, dir })}
      >
        {/* The channel lives in the tabs above, and a GET form submits only its
            own fields — without this, applying a filter would throw the
            seller back to all channels. */}
        <input type="hidden" name="channel" value={channel ?? ""} />

        <FilterField label="Search" className="min-w-[13rem] flex-1">
          <FilterInput
            type="search"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Order number, SKU or customer"
          />
        </FilterField>
        <FilterField label="Flag">
          <FilterSelect
            name="flag"
            defaultValue={flag ?? ""}
            options={FLAG_FILTER_OPTIONS}
          />
        </FilterField>
        <FilterField label="Fulfilled by">
          <FilterSelect
            name="fulfilment"
            defaultValue={fulfilment ?? ""}
            options={FULFILMENT_OPTIONS}
          />
        </FilterField>
        <FilterField label="Period">
          <FilterSelect name="window" defaultValue={window} options={WINDOW_OPTIONS} />
        </FilterField>
        <FilterField label="Amount">
          <span className="flex items-center gap-1.5">
            <FilterInput
              type="number"
              name="min"
              min={0}
              step="any"
              defaultValue={minAmount ?? ""}
              placeholder="min"
              className="w-24"
            />
            <span aria-hidden className="text-muted-soft">
              –
            </span>
            <FilterInput
              type="number"
              name="max"
              min={0}
              step="any"
              defaultValue={maxAmount ?? ""}
              placeholder="max"
              className="w-24"
            />
          </span>
        </FilterField>
      </Toolbar>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FlagRules rules={rules} />
        {/* An anchor, not a press: it leaves with a file rather than changing
            the screen, and the route re-reads these same parameters so what
            downloads is what is on screen. */}
        <a
          href={`/api/orders/export?${exportQuery.toString()}`}
          className={pressClass({ ground: "quiet", size: "sm" })}
          title={
            totals.orders > EXPORT_LIMIT
              ? `The first ${EXPORT_LIMIT} of ${totals.orders} orders. The filename says so.`
              : "The rows below, as they are filtered."
          }
        >
          Export CSV ↓
        </a>
      </div>

      <TableFrame minWidth="64rem">
        <thead>
          <tr>
            {/* Flags lead the table because they are the reason a row is where
                it is. The spec sketched them last; last is where a column goes
                when it can be scrolled for, and this one cannot. */}
            <SortableTh {...heading("attention")}>Flags</SortableTh>
            <SortableTh {...heading("order_date")}>Date</SortableTh>
            <SortableTh {...heading("order_number")}>Order</SortableTh>
            <SortableTh {...heading("channel")}>Channel</SortableTh>
            <SortableTh {...heading("customer_name")}>Customer</SortableTh>
            {/* Not sortable: the cell holds a list of SKUs and a unit count,
                and neither is what a click on "SKUs" would promise to order
                the table by. */}
            <Th>SKUs</Th>
            <SortableTh {...heading("order_total")} align="right">
              Amount
            </SortableTh>
            <SortableTh {...heading("financial_status")}>Payment</SortableTh>
            <SortableTh {...heading("fulfillment_status")}>Fulfilment</SortableTh>
            <SortableTh {...heading("last_synced_at")}>Last update</SortableTh>
          </tr>
        </thead>
        <tbody>
          {page.rows.length === 0 ? (
            <EmptyRow colSpan={10}>{emptyMessage(flag, filtered, windowLabel)}</EmptyRow>
          ) : (
            page.rows.map((order) => {
              const key = selectedOrderKey(order.channel, order.external_order_id);
              const href = listingHref(PATH, query, { order: key });
              const isOpen = selectedKey === key;

              return (
                <ClickableRow key={key} href={hrefToString(href)} selected={isOpen}>
                  <Td>
                    <FlagChips flags={order.flags} rules={rules} />
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(order.order_date)}</Td>
                  <Td className="font-medium">
                    <span className="inline-flex items-center gap-0.5">
                      <Link
                        href={href}
                        className="underline-offset-2 hover:text-primary-600 hover:underline"
                      >
                        {order.order_number || order.external_order_id}
                      </Link>
                      {/* Beside the number rather than in a column of its own:
                          a column would be empty on every row whose connection
                          cannot supply one, and read as data missing. */}
                      <ChannelAdminLink
                        channel={order.channel}
                        href={order.external_url}
                        label={`Open order ${
                          order.order_number || order.external_order_id
                        } in ${order.channel === "amazon" ? "Seller Central" : "the Shopify admin"}`}
                      />
                    </span>
                  </Td>
                  <Td>
                    <ChannelBadge channel={order.channel} />
                  </Td>
                  <Td className="max-w-[10rem] truncate text-muted">
                    {order.customer_name || "—"}
                  </Td>
                  <Td className="max-w-[14rem]">
                    <span className="block truncate" title={order.skus.join(", ")}>
                      {order.skus.join(", ") || "—"}
                    </span>
                    <span className="text-[11.5px] text-muted-soft">
                      {formatNumber(order.units)} units
                    </span>
                  </Td>
                  <Td align="right">
                    {formatMoney(order.order_total, order.currency)}
                  </Td>
                  <Td>
                    <StatusText value={order.financial_status} />
                  </Td>
                  <Td>
                    <StatusText value={order.fulfillment_status} />
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(order.last_synced_at)}
                  </Td>
                </ClickableRow>
              );
            })
          )}
        </tbody>
      </TableFrame>

      <Pagination
        total={page.total}
        start={page.start}
        limit={page.limit || PAGE_SIZE}
        unit="orders"
        hrefFor={(offset) => listingHref(PATH, query, { start: offset, order: undefined })}
      />

      {selected ? (
        <OrderPanel
          order={detail}
          rules={rules}
          closeHref={listingHref(PATH, query, { order: undefined })}
        />
      ) : null}
    </div>
  );
}

/** Switching channel keeps every other filter and starts again at page one. */
function channelHref(query: ListingQuery, channel: string | undefined) {
  return listingHref(PATH, query, { channel, start: 0, order: undefined });
}

function currencyBreakdown(totals: { by_currency: { currency: string | null; orders: number }[] }) {
  return totals.by_currency
    .map((row) => `${row.currency ?? "unknown"}: ${row.orders} orders`)
    .join(", ");
}

/**
 * What an empty table says.
 *
 * "Nothing needs attention" is a different sentence from "no results", and it
 * is the one a seller filtering for problems wants to read — a blank table
 * under a red filter chip otherwise looks like something failed.
 */
function emptyMessage(
  flag: string | undefined,
  filtered: boolean,
  windowLabel: string,
): string {
  if (flag === "attention") {
    return "Nothing needs attention in this period. Everything is paid, shipped or on its way.";
  }
  if (filtered) return "No orders match those filters.";
  return `No orders in the ${windowLabel.toLowerCase()}. Try a longer period.`;
}
