import Link from "next/link";
import { formatDateTime, formatMoney } from "@/lib/format";
import { channelName } from "@/lib/channels";
import { byChannel, healthPresentation, listingWeaknesses } from "@/lib/listings/presentation";
import type { ChannelId } from "@/lib/backend/types";
import type { ChannelListing, ProductGroup } from "@/lib/product-groups/types";

/**
 * One product, both channels, side by side.
 *
 * The comparison is the whole feature. A seller looking at a suppressed Amazon
 * listing needs to see that the Shopify description is three times longer and
 * has five images to it — that is what turns "Amazon took it down" into
 * something to do. So the two columns carry the same fields in the same order
 * at the same scale, and a field one channel does not have says so rather than
 * collapsing and knocking the rows out of alignment.
 *
 * **Read-only.** V1 links out; editing in-app with channel push is V2. Every
 * column therefore ends with the two links that matter — the live listing and
 * the seller's own admin for it — and the header says where edits happen, so
 * nobody hunts for a save button that was never there.
 *
 * A single-channel group draws one column and says the other channel is not
 * used, which is a valid product rather than a broken one.
 */

export function GroupDetail({
  group,
  closeHref,
}: {
  group: ProductGroup;
  closeHref: string;
}) {
  const { shopify, amazon } = byChannel(group.listings);

  return (
    <section
      aria-label={`${group.name} across channels`}
      className="space-y-3 rounded-sm border border-highlight-400 bg-highlight-100/50 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-display-sm">{group.name}</h2>
          <p className="text-[12px] text-muted">
            <span className="font-data">{group.brand_sku}</span>
            {group.barcode ? (
              <>
                {" · barcode "}
                <span className="font-data">{group.barcode}</span>
              </>
            ) : null}
            {group.category ? ` · ${group.category}` : null}
          </p>
          {/* Said once, at the top, rather than beside every field. */}
          <p className="text-[12px] text-muted">
            Read-only here — changes are made on the channel itself.
          </p>
        </div>

        <Link
          href={closeHref}
          className="shrink-0 rounded-xs px-2 py-1 text-[12px] text-muted transition-colors hover:bg-primary-600/5 hover:text-primary-600"
        >
          Close ✕
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Column channel="shopify" listing={shopify} />
        <Column channel="amazon" listing={amazon} />
      </div>
    </section>
  );
}

function Column({
  channel,
  listing,
}: {
  channel: ChannelId;
  listing?: ChannelListing;
}) {
  if (!listing) {
    return (
      <article className="rounded-sm border border-line border-dashed bg-white/60 p-4">
        <h3 className="text-display-xs text-primary-600">{channelName(channel)}</h3>
        <p className="pt-2 text-[13px] text-muted">
          Not listed on {channelName(channel)}. If that is deliberate this is a
          channel-exclusive product and nothing is wrong; if not, the unlinked
          panel below is where a match gets made.
        </p>
      </article>
    );
  }

  const health = healthPresentation(listing.health);
  const weaknesses = listingWeaknesses(listing);

  return (
    <article className="space-y-3 rounded-sm border border-line bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-display-xs text-primary-600">{channelName(channel)}</h3>
        <span
          title={health.blurb}
          className={`inline-flex items-center gap-1.5 rounded-xs border px-2 py-0.5 font-sans text-[11px] font-medium ${health.pill}`}
        >
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
          {health.label}
        </span>
      </header>

      {/* The suppression reason in plain English, at the top of the column,
          because it is the only thing on this screen that has to be read. The
          raw Amazon code sits in the tooltip for support to quote. */}
      {listing.suppression_reason ? (
        <p
          title={listing.suppression_code ?? undefined}
          className="rounded-sm border border-alert/30 bg-alert-soft px-3 py-2 text-[12.5px] leading-snug text-alert-ink"
        >
          {listing.suppression_reason}
          {listing.suppressed_since ? (
            <span className="block pt-0.5 text-[11.5px]">
              Since {formatDateTime(listing.suppressed_since)}.
            </span>
          ) : null}
        </p>
      ) : null}

      {weaknesses.length ? (
        <p className="text-[12px] text-warn-ink">
          Thin on this channel: {weaknesses.join(", ")}.
        </p>
      ) : null}

      <Images listing={listing} />

      <dl className="space-y-2 text-[13px]">
        <Field label="Title">{listing.title || "—"}</Field>
        <Field label="Price">
          <span className="font-data">{formatMoney(listing.price, listing.currency)}</span>
        </Field>
        <Field label="Status">
          {/* The channel's own word, unmapped — Shopify's ACTIVE and Amazon's
              vocabulary do not mean the same thing, so neither is translated. */}
          <span className="font-data">{listing.status || "—"}</span>
        </Field>
        <Field label="Category">{listing.category || "—"}</Field>
        <Field label="SKU">
          <span className="font-data">{listing.sku || "—"}</span>
        </Field>
        <Field label={channel === "amazon" ? "ASIN" : "Handle"}>
          <span className="font-data">{listing.external_id}</span>
        </Field>
        {listing.health_score !== undefined ? (
          <Field label="Listing score">
            <span className="font-data">{listing.health_score}/100</span>
          </Field>
        ) : null}
      </dl>

      <div className="space-y-1">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
          Description
        </p>
        <p className="text-[13px] leading-snug text-muted">
          {listing.description || "No description on this channel."}
        </p>
      </div>

      {/* Bullets are an Amazon field. Shopify has none, so the section is
          absent there rather than empty — an empty "Bullet points" heading on
          the Shopify column would read as a listing problem. */}
      {channel === "amazon" ? (
        <div className="space-y-1">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
            Bullet points ({listing.bullets?.length ?? 0} of 5)
          </p>
          {listing.bullets?.length ? (
            <ul className="list-disc space-y-0.5 pl-4 text-[13px] leading-snug text-muted">
              {listing.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-warn-ink">
              None set. Amazon allows five, and they carry search weight.
            </p>
          )}
        </div>
      ) : null}

      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2.5 text-[12px]">
        {listing.storefront_url ? (
          <ExternalLink href={listing.storefront_url}>
            View on {channelName(channel)}
          </ExternalLink>
        ) : null}
        {listing.admin_url ? (
          <ExternalLink href={listing.admin_url}>
            {channel === "amazon" ? "Open in Seller Central" : "Open in Shopify admin"}
          </ExternalLink>
        ) : null}
        <span className="ml-auto text-muted-soft">
          Synced {formatDateTime(listing.last_synced_at)}
        </span>
      </footer>
    </article>
  );
}

/**
 * The images, with the count.
 *
 * Both channels' URLs load in the browser directly — Shopify's CDN and
 * Amazon's image host are both public — so no proxy is needed. The count
 * matters as much as the thumbnails: "2 images" beside a suppression for a
 * bad main image is most of the diagnosis.
 *
 * A plain `<img>`, not `next/image`: these are arbitrary third-party hosts,
 * and the optimiser needs each one allow-listed in next.config. An unoptimised
 * thumbnail is the right trade for a URL we do not control.
 */
function Images({ listing }: { listing: ChannelListing }) {
  return (
    <div className="space-y-1">
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500">
        Images ({listing.images.length})
      </p>
      {listing.images.length === 0 ? (
        <p className="text-[13px] text-alert-ink">
          No images. Neither channel will show this listing properly.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {listing.images.slice(0, 6).map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={
                index === 0
                  ? `${listing.title ?? "Product"} — main image`
                  : `${listing.title ?? "Product"} — image ${index + 1}`
              }
              loading="lazy"
              className="h-14 w-14 rounded-xs border border-line object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-[12px] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink">{children}</dd>
    </div>
  );
}

/** Leaves the app, so it says so and opens away from the tab. */
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary-600 underline-offset-2 hover:underline"
    >
      {children} ↗
    </a>
  );
}
