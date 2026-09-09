import Link from "next/link";
import { requireOnboardedSession } from "@/lib/auth/dal";
import {
  PAGE_SIZE,
  PRODUCT_SORT_FIELDS,
  VELOCITY_WINDOWS,
  inventorySummary,
  listProducts,
  loadStock,
  type ProductSortField,
} from "@/lib/backend/inventory";
import { channelName } from "@/lib/channels";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import {
  firstValue,
  listingHref,
  parseChannel,
  parseDirection,
  parseOffset,
  parseSortField,
  type ListingQuery,
} from "@/lib/listing";
import {
  ChannelBadge,
  EmptyRow,
  SortableTh,
  StatusText,
  TableFrame,
  Td,
  Th,
} from "@/components/data/table";
import { Pagination } from "@/components/data/pagination";
import { SummaryChip, SummaryStrip } from "@/components/data/summary";
import {
  FilterField,
  FilterInput,
  FilterSelect,
  Toolbar,
} from "@/components/data/toolbar";
import { Alert, Eyebrow } from "@/components/ui";
import { ImportingBanner } from "@/components/data/importing-banner";
import { isImporting, loadCurrentImport } from "@/lib/backend/imports";
import { ChannelTabs } from "@/components/data/channel-tabs";
import { SampleBanner } from "@/components/data/sample-banner";
import { PurchaseOrders } from "@/app/(app)/inventory/purchase-orders";
import { StockTable } from "@/app/(app)/inventory/stock-table";

export const metadata = { title: "Inventory — Alaiy" };

const PATH = "/inventory";

/**
 * Which grain the tab opens on.
 *
 * "products", because the reorder decision is what a seller comes here for.
 * Both grains now read live data, so this is a plain preference rather than a
 * choice between real and fabricated figures as it was while the product view
 * was mock.
 */
const DEFAULT_VIEW = "products";

type View = "products" | "listings";

function parseView(value: string | string[] | undefined): View {
  return firstValue(value) === "listings" ? "listings" : DEFAULT_VIEW;
}

/**
 * The sell-through window, or nothing.
 *
 * Nothing means "use the workspace's own setting", which is a real answer and
 * different from picking 14: a seller who has configured 30 days should not
 * have it silently overridden by a default in the URL parser.
 */
function parseDays(value: string | string[] | undefined): number | undefined {
  const raw = Number(firstValue(value));
  return (VELOCITY_WINDOWS as readonly number[]).includes(raw) ? raw : undefined;
}

/**
 * The Inventory tab, at two grains, because two different questions are asked
 * of it and neither answer is derivable from the other.
 *
 * **By product** (`?view=products`, the default) is one row per physical
 * product: the warehouse's number, Shopify's and Amazon FBA's shown separately
 * rather than summed, plus the days-of-cover arithmetic none of the three
 * sources does for you. This is the reorder decision, and it is the reason the
 * tab exists — "I have three inventory numbers that disagree" is only half the
 * problem; "and none of them says when I run out" is the rest.
 *
 * **By channel listing** (`?view=listings`) is the original grain, one row per
 * (product, channel), reading live from the backend. It is kept, not replaced:
 * the per-channel price and stock figure are facts a merged row would have to
 * average away, and a seller reconciling a specific Shopify listing needs to
 * see exactly what that channel reported.
 *
 * The sell-through window (`?days=`) belongs to the product view: 7 days
 * describes a fast mover, 30 is what a slow one needs to have a rate at all.
 * It changes how the same data is read rather than the workspace's reorder
 * policy, so it stays in the URL and nothing is saved.
 *
 * Filters, sort, offset and the view all live in the URL (see @/lib/listing),
 * so the server does the work, the back button behaves, and a filtered view
 * can be shared as a link.
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireOnboardedSession();
  const params = await searchParams;

  const view = parseView(params.view);
  const channel = parseChannel(params.channel);
  const search = firstValue(params.q);
  const sort = parseSortField<ProductSortField>(
    params.sort,
    PRODUCT_SORT_FIELDS,
    "last_synced_at",
  );
  const dir = parseDirection(params.dir);
  const start = parseOffset(params.start);
  const days = parseDays(params.days);

  // The summary counts the whole catalogue, not the filtered page — it is the
  // header for the tab, and a count that moved with the search box would stop
  // answering "how much is in here?".
  //
  // Both grains are fetched regardless of which is showing. They are one round
  // trip in parallel, and the alternative — branching the fetch on `view` —
  // makes switching grain a second wait for data the server could already have
  // had.
  const [{ page, error }, summary, currentImport, stockResult] = await Promise.all([
    listProducts(
      { channel, search, start, orderBy: sort, order: dir },
      session.backendToken,
    ),
    inventorySummary(session.backendToken),
    // Cached, so this is the call the layout already made for the status box.
    loadCurrentImport(session.workspaceId, session.backendToken),
    loadStock(days, session.backendToken),
  ]);

  const stock = stockResult.page;

  const query: ListingQuery = { q: search, channel, sort, dir, start, view };
  const filtered = Boolean(search || channel);

  /** A sort link flips direction on the active column and defaults elsewhere. */
  const sortHref = (field: ProductSortField) =>
    listingHref(PATH, query, {
      sort: field,
      dir: sort === field && dir === "desc" ? "asc" : "desc",
      start: 0,
    });

  const heading = (field: ProductSortField) => ({
    href: sortHref(field),
    active: sort === field,
    direction: sort === field ? dir : ("desc" as const),
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your data</Eyebrow>
        <h1 className="text-display-md">Inventory</h1>
        <p className="text-[13px] text-muted">
          {view === "products"
            ? "One row per product: every source's number, and how many days of cover that leaves."
            : "Every product your connected channels report, one row per channel listing."}
        </p>
      </div>

      {/* Two grains, not two tabs' worth of navigation: the same products,
          merged or per channel. */}
      <ChannelTabs
        label="Inventory grain"
        active={view}
        tabs={[
          {
            value: "products",
            label: "By product",
            href: { pathname: PATH, query: { view: "products" } },
          },
          {
            value: "listings",
            label: "By channel listing",
            href: listingHref(PATH, query, { view: "listings", start: 0 }),
          },
        ]}
      />

      {isImporting(currentImport) ? (
        <ImportingBanner job={currentImport} />
      ) : null}

      {view === "products" ? (
        <>
          {stock.sample ? <SampleBanner what="Inventory by product" /> : null}
          {stockResult.error ? <Alert>{stockResult.error}</Alert> : null}
          <VelocityToggle active={stock.velocity_days ?? days ?? 14} />
          <StockTable page={stock} />
          <PurchaseOrders orders={stock.purchase_orders} rows={stock.rows} />
        </>
      ) : null}

      {view === "listings" && summary.length ? (
        <SummaryStrip>
          {summary.map((row) => (
            <SummaryChip
              key={row.channel}
              channel={channelName(row.channel)}
              figures={[
                { label: "products", value: formatNumber(row.products) },
                { label: "units", value: formatNumber(row.units ?? 0) },
              ]}
            />
          ))}
        </SummaryStrip>
      ) : null}

      {view === "listings" && error ? <Alert>{error}</Alert> : null}

      {view === "listings" ? (
        <>
        <Toolbar
          action={PATH}
          sort={sort}
          dir={dir}
          filtered={filtered}
          clearHref={listingHref(PATH, { sort, dir, view })}
        >
          {/* A GET form submits only its own fields, so without this, applying
              a filter would drop the seller back into the product grain. */}
          <input type="hidden" name="view" value={view} />

          <FilterField label="Search" className="min-w-[14rem] flex-1">
            <FilterInput
              type="search"
              name="q"
              defaultValue={search ?? ""}
              placeholder="SKU or title"
            />
          </FilterField>
          <FilterField label="Channel">
            <FilterSelect
              name="channel"
              defaultValue={channel ?? ""}
              options={[
                { value: "", label: "All channels" },
                { value: "shopify", label: "Shopify" },
                { value: "amazon", label: "Amazon" },
              ]}
            />
          </FilterField>
        </Toolbar>

        <TableFrame minWidth="44rem">
          <thead>
            <tr>
              <SortableTh {...heading("sku")}>SKU</SortableTh>
              <SortableTh {...heading("title")}>Product</SortableTh>
              <SortableTh {...heading("channel")}>Channel</SortableTh>
              <SortableTh {...heading("status")}>Status</SortableTh>
              <SortableTh {...heading("price")} align="right">
                Price
              </SortableTh>
              <SortableTh {...heading("available_qty")} align="right">
                Available
              </SortableTh>
              <Th>Synced</Th>
            </tr>
          </thead>
          <tbody>
            {page.rows.length === 0 ? (
              <EmptyRow colSpan={7}>
                {filtered
                  ? "No products match those filters."
                  : "No products yet. They appear here as soon as an import finishes."}
              </EmptyRow>
            ) : (
              page.rows.map((product) => (
                <tr key={product.name} className="transition-colors hover:bg-primary-600/[0.04]">
                  <Td className="font-medium">{product.sku || "—"}</Td>
                  <Td>
                    {/* The channel's own listing, when it gave us a URL. New tab
                        because it leaves the app entirely. */}
                    {product.external_url ? (
                      <a
                        href={product.external_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary-600 underline-offset-2 hover:underline"
                      >
                        {product.title || "Untitled"}
                      </a>
                    ) : (
                      product.title || "Untitled"
                    )}
                  </Td>
                  <Td>
                    <ChannelBadge channel={product.channel} />
                  </Td>
                  <Td>
                    <StatusText value={product.status} />
                  </Td>
                  <Td align="right">
                    {formatMoney(product.price, product.currency)}
                  </Td>
                  <Td align="right">{formatNumber(product.available_qty)}</Td>
                  <Td className="whitespace-nowrap text-muted">
                    {formatDate(product.last_synced_at)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableFrame>

        <Pagination
          total={page.total}
          start={page.start}
          limit={page.limit || PAGE_SIZE}
          unit="products"
          hrefFor={(offset) => listingHref(PATH, query, { start: offset })}
        />
        </>
      ) : null}
    </div>
  );
}

/**
 * How many days of sales the rate is averaged over.
 *
 * The spec's 7/14/30. A slow-moving product needs 30 to have a rate at all,
 * and a fast one is better described by 7 — the same stock is a different
 * number of days depending on which you ask, and the seller is the one who
 * knows which describes their product.
 *
 * Links rather than a form, so each window is its own shareable URL and the
 * back button steps through them.
 */
function VelocityToggle({ active }: { active: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-muted">
      <span className="font-sans font-semibold uppercase tracking-[0.12em] text-primary-500">
        Sales averaged over
      </span>
      {VELOCITY_WINDOWS.map((days) => (
        <Link
          key={days}
          href={{ pathname: PATH, query: { view: "products", days } }}
          aria-current={days === active ? "true" : undefined}
          className={
            days === active
              ? "rounded-xs border border-line bg-surface px-1.5 py-0.5 font-data text-ink"
              : "px-1.5 py-0.5 underline-offset-2 hover:text-primary-600 hover:underline"
          }
        >
          {days} days
        </Link>
      ))}
    </div>
  );
}
