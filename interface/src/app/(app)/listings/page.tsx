import Link from "next/link";
import { requireOnboardedSession } from "@/lib/auth/dal";
import { loadGroup, loadListings } from "@/lib/backend/listings";
import { firstValue, hrefToString, parseChannel } from "@/lib/listing";
import { formatDateTime } from "@/lib/format";
import {
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
import { SampleBanner } from "@/components/data/sample-banner";
import {
  HEALTH_FILTER_OPTIONS,
  byChannel,
  healthPresentation,
  linkPresentation,
} from "@/lib/listings/presentation";
import { GroupDetail } from "@/app/(app)/listings/group-detail";
import { Unlinked } from "@/app/(app)/listings/unlinked";
import type { ChannelListing, ListingHealth, ProductGroup } from "@/lib/product-groups/types";

export const metadata = { title: "Listings — Alaiy" };

const PATH = "/listings";

/**
 * The Listings tab: one physical product, however many channels sell it.
 *
 * The Canvas Tote Bag is one thing to photograph and one thing to describe.
 * That it is `CT-TOTE-BLK-001` on Shopify and `B09XKQL3M2` on Amazon is an
 * accident of where it is listed — and it is the reason an Amazon suppression
 * can sit there for a week without anything in Shopify mentioning it. Every
 * other table in this app has a channel column; this one has a channel
 * *column pair*, because the question here is what the two sides say about the
 * same product.
 *
 * **Read-only, and the screen says so.** Edits happen on the channel, and the
 * detail view links out to both the live listing and the seller's own admin.
 * Writing listing changes back is explicitly V2 — a tab that looked editable
 * and silently was not would be worse than one that is honest about it.
 *
 * Which group is open lives in `?group=`, and the filters in the URL beside
 * it, for the same reason as every other listing tab: a filtered view with one
 * product expanded is a link someone can send to whoever is fixing it.
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
  const openGroup = firstValue(params.group);

  // The filters go to the backend rather than being applied here: the category
  // list and the filtered set are computed from the same read, so they cannot
  // disagree about what exists.
  //
  // The open group is fetched separately rather than found in the list, because
  // `?group=` is a shareable link and can name a product the recipient's
  // filters exclude — a link that opened an empty panel would be baffling.
  const [{ page, error }, opened] = await Promise.all([
    loadListings({ health, channel, category }, session.backendToken),
    openGroup
      ? loadGroup(openGroup, session.backendToken)
      : Promise.resolve(null),
  ]);

  const groups = page.groups;
  const group = opened?.group ?? null;

  const query = {
    health: health ?? "",
    channel: channel ?? "",
    category: category ?? "",
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
          One row per product, both channels side by side. Edits happen on the
          channel — every listing here links out to it.
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
        <FilterField label="Sold on">
          <FilterSelect
            name="channel"
            defaultValue={channel ?? ""}
            options={[
              { value: "", label: "Either channel" },
              { value: "shopify", label: "Shopify" },
              { value: "amazon", label: "Amazon" },
            ]}
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
            <Th>Product</Th>
            <Th>Brand SKU</Th>
            <Th>Shopify</Th>
            <Th>Amazon</Th>
            <Th>Health</Th>
            <Th>Linked by</Th>
            <Th>Synced</Th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <EmptyRow colSpan={7}>
              {filtered
                ? "No products match those filters."
                : "No products yet. They appear here once your channels sync."}
            </EmptyRow>
          ) : (
            groups.map((row) => (
              <GroupRow
                key={row.id}
                group={row}
                href={hrefWith({ group: row.id === openGroup ? undefined : row.id })}
                open={row.id === openGroup}
              />
            ))
          )}
        </tbody>
      </TableFrame>

      {/* A group named in the URL that could not be read says so, rather than
          silently rendering nothing — the link was to something specific. */}
      {opened?.error ? <Alert>{opened.error}</Alert> : null}

      {group ? (
        <GroupDetail group={group} closeHref={hrefWith({ group: undefined })} />
      ) : null}

      <Unlinked products={page.unlinked} />
    </div>
  );
}

function GroupRow({
  group,
  href,
  open,
}: {
  group: ProductGroup;
  href: string;
  open: boolean;
}) {
  const { shopify, amazon } = byChannel(group.listings);
  const health = healthPresentation(group.health);
  const link = linkPresentation(group.link_method);

  return (
    <tr className={open ? "bg-highlight-100" : "transition-colors hover:bg-primary-600/[0.04]"}>
      <Td className="font-medium">
        <Link href={href} className="underline-offset-2 hover:text-primary-600 hover:underline">
          {group.name}
        </Link>
      </Td>
      <Td className="text-muted">{group.brand_sku}</Td>
      <Td>
        <ChannelStatus listing={shopify} />
      </Td>
      <Td>
        <ChannelStatus listing={amazon} />
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
      <Td>
        <span className="text-[11.5px] text-muted" title={link.blurb}>
          {link.label}
          {group.link_confidence ? (
            <span className="font-data"> · {group.link_confidence}%</span>
          ) : null}
        </span>
      </Td>
      <Td className="whitespace-nowrap text-muted">{formatDateTime(group.last_synced_at)}</Td>
    </tr>
  );
}

/**
 * One channel's cell.
 *
 * An absent listing is "not listed", not an em dash: a product sold only on
 * Amazon is a valid product group, and a blank cell in a column where every
 * other row has a status reads as data that failed to load.
 */
function ChannelStatus({ listing }: { listing?: ChannelListing }) {
  if (!listing) {
    return <span className="text-[11.5px] text-muted-soft">Not listed</span>;
  }
  const health = healthPresentation(listing.health);
  return (
    <span className="flex items-center gap-1.5" title={listing.status ?? health.label}>
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${health.dot}`} />
      <span className={`text-[12px] ${health.ink}`}>{health.label}</span>
    </span>
  );
}

function parseHealth(value: string | string[] | undefined): ListingHealth | undefined {
  const raw = firstValue(value);
  return raw === "live" || raw === "warning" || raw === "suppressed" ? raw : undefined;
}
