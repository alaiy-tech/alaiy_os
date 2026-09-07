import { requireOnboardedSession } from "@/lib/auth/dal";
import {
  PAGE_SIZE,
  PRODUCT_SORT_FIELDS,
  inventorySummary,
  listProducts,
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

export const metadata = { title: "Inventory — Alaiy" };

const PATH = "/inventory";

/**
 * The Inventory tab: every product from every connected channel.
 *
 * The grain is (product, channel), so a SKU sold on both appears twice — the
 * price and the stock figure are per channel, and a merged row would have to
 * invent a number neither channel reported. The channel column is what makes
 * that legible rather than confusing.
 *
 * Filters, sort and offset all live in the URL (see @/lib/listing), so the
 * server does the work, the back button behaves, and a filtered view can be
 * shared as a link.
 */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireOnboardedSession();
  const params = await searchParams;

  const channel = parseChannel(params.channel);
  const search = firstValue(params.q);
  const sort = parseSortField<ProductSortField>(
    params.sort,
    PRODUCT_SORT_FIELDS,
    "last_synced_at",
  );
  const dir = parseDirection(params.dir);
  const start = parseOffset(params.start);

  // The summary counts the whole catalogue, not the filtered page — it is the
  // header for the tab, and a count that moved with the search box would stop
  // answering "how much is in here?".
  const [{ page, error }, summary, currentImport] = await Promise.all([
    listProducts(
      { channel, search, start, orderBy: sort, order: dir },
      session.backendToken,
    ),
    inventorySummary(session.backendToken),
    // Cached, so this is the call the layout already made for the status box.
    loadCurrentImport(session.workspaceId, session.backendToken),
  ]);

  const query: ListingQuery = { q: search, channel, sort, dir, start };
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
          Every product your connected channels report, one row per channel
          listing.
        </p>
      </div>

      {isImporting(currentImport) ? (
        <ImportingBanner job={currentImport} />
      ) : null}

      {summary.length ? (
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

      {error ? <Alert>{error}</Alert> : null}

      <Toolbar
        action={PATH}
        sort={sort}
        dir={dir}
        filtered={filtered}
        clearHref={listingHref(PATH, { sort, dir })}
      >
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
    </div>
  );
}
