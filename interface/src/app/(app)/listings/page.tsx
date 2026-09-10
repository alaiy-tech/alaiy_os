import Link from "next/link";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { PAGE_SIZE, loadListing, loadListings } from "@/lib/backend/listings";
import { firstValue, hrefToString, parseChannel, parseOffset } from "@/lib/listing";
import { channelOptions } from "@/lib/channels";
import { formatDateTime, formatMoney } from "@/lib/format";
import {
  ChannelBadge,
  EmptyRow,
  TableFrame,
  Td,
  Th,
} from "@/components/data/table";
import {
  FilterField,
  FilterSelect,
  Toolbar,
} from "@/components/data/toolbar";
import { Alert, Eyebrow } from "@/components/ui";
import { Pagination } from "@/components/data/pagination";
import { SampleBanner } from "@/components/data/sample-banner";
import { HEALTH_FILTER_OPTIONS, healthPresentation } from "@/lib/listings/presentation";
import { ListingDetailPanel } from "@/app/(app)/listings/listing-detail";
import type { Listing, ListingHealth } from "@/lib/listings/types";

export const metadata = { title: "Listings — Alaiy" };

const PATH = "/listings";
const COLUMN_COUNT = 7;

/**
 * The Listings tab: one row per listing, which is one row per (channel, SKU).
 *
 * This tab used to show one row per *physical product*, with a column pair for
 * what Shopify and Amazon each said about it. That grouping is gone. The
 * pairing behind it was a barcode match or a title score, and a row built on a
 * wrong pairing was wrong everywhere at once and in a way nothing downstream
 * could detect. A listing is the thing the channel actually has, and the
 * channel is where it gets fixed.
 *
 * **Read-only, and the screen says so.** Edits happen on the channel, and the
 * detail view links out to both the live listing and the seller's own admin.
 * Writing listing changes back is explicitly V2 — a tab that looked editable
 * and silently was not would be worse than one that is honest about it.
 *
 * Which listing is open lives in `?listing=`, and the filters in the URL beside
 * it, for the same reason as every other listing tab: a filtered view with one
 * row expanded is a link someone can send to whoever is fixing it.
 *
 * **One table, one offset.** There were two — `start` for the comparison and
 * `ustart` for the unlinked queue below it, read separately because the queue
 * computed a suggestion per row. The queue was a consequence of the grouping,
 * so it goes with it, and `ustart` no longer means anything.
 */
export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireOnboardedSession();
  const params = await searchParams;

  const health = parseHealth(params.health);
  const channel = parseChannel(params.channel);
  const category = firstValue(params.category);
  const openListing = firstValue(params.listing);
  const start = parseOffset(params.start);

  // The filters, the ordering and the offset all go to the backend rather than
  // being applied here: a filter applied after the page was chosen would hand
  // back "the rows of page one that happen to be suppressed" and call it the
  // suppressed listings. The category list comes from the same read, so it
  // cannot disagree with the filtered set about what exists.
  //
  // The open listing is fetched separately rather than found in the page,
  // because `?listing=` is a shareable link and can name a row the recipient's
  // filters exclude, or one on another page entirely.
  const [{ page, error }, opened] = await Promise.all([
    loadListings({ health, channel, category, start }, session.backendToken),
    openListing
      ? loadListing(openListing, session.backendToken)
      : Promise.resolve(null),
  ]);

  const listings = page.listings;
  const detail = opened?.listing ?? null;

  // The offset rides in the query, so a link that changes a filter keeps it.
  // Page one is the absence of the parameter rather than `start=0`, which is
  // what `hrefWith` dropping empty values gives for free. The filter bar is a
  // GET form and carries neither, so applying a filter lands on page one —
  // which is the only sensible place for it to land.
  const query = {
    health: health ?? "",
    channel: channel ?? "",
    category: category ?? "",
    start: start ? String(start) : "",
  };
  const hrefWith = (over: Record<string, string | undefined>) =>
    hrefToString({
      pathname: PATH,
      query: Object.fromEntries(
        Object.entries({ ...query, ...over }).filter(([, v]) => v),
      ) as Record<string, string>,
    });

  const filtered = Boolean(health || channel || category);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-6 sm:px-6">
      <div className="space-y-1.5">
        <Eyebrow>Your data</Eyebrow>
        <h1 className="text-display-md">Listings</h1>
        <p className="text-[13px] text-muted">
          One row per listing, on every channel you sell through. Edits happen
          on the channel — every listing here links out to it.
        </p>
      </div>

      {page.sample ? <SampleBanner what="Listings" /> : null}

      {/* The table's own failure. The shell, the filters the seller typed and
          the heading all survive it — an error page would lose their query. */}
      {error ? <Alert>{error}</Alert> : null}

      <Toolbar
        action={PATH}
        sort=""
        dir=""
        filtered={filtered}
        clearHref={{ pathname: PATH, query: {} }}
      >
        <FilterField label="Health">
          <FilterSelect
            name="health"
            defaultValue={health ?? ""}
            options={HEALTH_FILTER_OPTIONS}
          />
        </FilterField>
        <FilterField label="Channel">
          <FilterSelect
            name="channel"
            defaultValue={channel ?? ""}
            options={[{ value: "", label: "All channels" }, ...channelOptions()]}
          />
        </FilterField>
        <FilterField label="Category">
          <FilterSelect
            name="category"
            defaultValue={category ?? ""}
            options={[
              { value: "", label: "All categories" },
              ...page.categories.map((c) => ({ value: c, label: c })),
            ]}
          />
        </FilterField>
      </Toolbar>

      <TableFrame minWidth="56rem">
        <thead>
          <tr>
            <Th>Listing</Th>
            <Th>Channel</Th>
            <Th>SKU</Th>
            <Th>Status</Th>
            <Th align="right">Price</Th>
            <Th>Health</Th>
            <Th>Synced</Th>
          </tr>
        </thead>
        <tbody>
          {listings.length === 0 ? (
            <EmptyRow colSpan={COLUMN_COUNT}>
              {/* An empty page with a non-zero total is a hand-typed offset
                  past the end. Saying "no listings match" there would be a
                  lie about the filters rather than about the offset. */}
              {page.total > 0
                ? "Nothing on this page. Go back to the first one."
                : filtered
                  ? "No listings match those filters."
                  : "No listings yet. They appear here once your channels sync."}
            </EmptyRow>
          ) : (
            listings.map((row) => (
              <ListingRow
                key={row.id}
                listing={row}
                href={hrefWith({ listing: row.id === openListing ? undefined : row.id })}
                open={row.id === openListing}
              />
            ))
          )}
        </tbody>
      </TableFrame>

      <Pagination
        total={page.total}
        start={page.start}
        limit={page.limit || PAGE_SIZE}
        hrefFor={(offset) => hrefWith({ start: offset ? String(offset) : undefined })}
        unit="listings"
      />

      {/* A listing named in the URL that could not be read says so, rather than
          silently rendering nothing — the link was to something specific. */}
      {opened?.error ? <Alert>{opened.error}</Alert> : null}

      {detail ? (
        <ListingDetailPanel
          listing={detail}
          closeHref={hrefWith({ listing: undefined })}
        />
      ) : null}
    </div>
  );
}

function ListingRow({
  listing,
  href,
  open,
}: {
  listing: Listing;
  href: string;
  open: boolean;
}) {
  const health = healthPresentation(listing.health);

  return (
    <tr className={open ? "bg-highlight-100" : "transition-colors hover:bg-primary-600/[0.04]"}>
      <Td className="font-medium">
        <span className="flex items-center gap-2">
          {listing.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.image_url}
              alt=""
              loading="lazy"
              className="h-8 w-8 shrink-0 rounded-xs border border-line object-cover"
            />
          ) : null}
          <Link
            href={href}
            className="min-w-0 truncate underline-offset-2 hover:text-primary-600 hover:underline"
          >
            {listing.title || listing.external_id}
          </Link>
        </span>
      </Td>
      <Td>
        <ChannelBadge channel={listing.channel} />
      </Td>
      <Td className="font-data text-muted">{listing.sku || "—"}</Td>
      {/* The channel's own word, unmapped: a Shopify DRAFT and an Amazon
          suppression are not the same problem and do not have the same fix. */}
      <Td className="text-muted">{listing.status || "—"}</Td>
      <Td align="right" className="font-data whitespace-nowrap">
        {formatMoney(listing.price, listing.currency)}
      </Td>
      <Td>
        <span
          title={health.blurb}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs border px-2 py-0.5 font-sans text-[11px] font-medium ${health.pill}`}
        >
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
          {health.label}
        </span>
      </Td>
      <Td className="whitespace-nowrap text-muted">{formatDateTime(listing.last_synced_at)}</Td>
    </tr>
  );
}

function parseHealth(value: string | string[] | undefined): ListingHealth | undefined {
  const raw = firstValue(value);
  return raw === "live" || raw === "warning" || raw === "suppressed" ? raw : undefined;
}
